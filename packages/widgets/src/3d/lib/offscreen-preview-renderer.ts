import {
  AmbientLight,
  Cache,
  DirectionalLight,
  Group,
  Mesh,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
  type SkinnedMesh,
} from 'three';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import { loadGltfScene, clearGltfCache } from './preview-gltf-cache';
import { frameCameraToModel } from './preview-camera-framing';
import {
  createEnqueueRender,
  getRenderRequestKey,
  rejectListeners,
  resolveListeners,
  type QueueEntry,
} from './preview-render-queue';
import { setCachedPreviewResult } from './preview-result-cache';

export type { RenderRequest, AbortHandle } from './preview-render-queue';

Cache.enabled = true;

// ── Shared state ─────────────────────────────────────────────────────────────

let renderer: WebGLRenderer | null = null;
let scene: Scene | null = null;
let camera: OrthographicCamera | null = null;
let disposeTimer: ReturnType<typeof setTimeout> | null = null;
let isProcessing = false;
let contextLostHandler: ((event: Event) => void) | null = null;

const pendingByKey = new Map<string, QueueEntry>();
const queue: QueueEntry[] = [];

// ── Renderer lifecycle ───────────────────────────────────────────────────────

function createRenderer(): WebGLRenderer {
  const r = new WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'default',
  });
  r.setPixelRatio(1);

  contextLostHandler = (event) => {
    event.preventDefault();
    handleContextLost();
  };
  r.domElement.addEventListener('webglcontextlost', contextLostHandler);

  return r;
}

// 씬에는 조명만 둔다. 배경·바닥판을 씬에 구우면 PNG 가 특정 테마에 묶이므로
// (alpha: true 렌더러 + 배경 미설정으로) 투명 PNG 를 만들고, 접지 그림자·배경은
// 표시 측 CSS(scene-model-preview.tsx)가 테마 토큰으로 그린다.
function createScene(): Scene {
  const s = new Scene();

  const ambient = new AmbientLight(0xffffff, 2.4);
  s.add(ambient);

  const dir1 = new DirectionalLight(0xffffff, 4.4);
  dir1.position.set(3, 4, 2);
  s.add(dir1);

  const dir2 = new DirectionalLight(0xffffff, 1.2);
  dir2.position.set(-2, 2, -3);
  s.add(dir2);

  return s;
}

function handleContextLost() {
  for (const entry of queue) {
    if (!entry.aborted) {
      rejectListeners(entry, new Error('WebGL context lost'));
    }
  }
  queue.length = 0;
  pendingByKey.clear();
  isProcessing = false;

  renderer = null;
  scene = null;
  camera = null;
}

function ensureRenderer(): void {
  if (disposeTimer !== null) {
    clearTimeout(disposeTimer);
    disposeTimer = null;
  }

  if (!renderer) {
    renderer = createRenderer();
    scene = createScene();
    camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  }
}

function scheduleDispose(): void {
  if (disposeTimer !== null || isProcessing || queue.length > 0) {
    return;
  }

  disposeTimer = setTimeout(() => {
    disposeAll();
  }, 5000);
}

function disposeAll() {
  if (disposeTimer !== null) {
    clearTimeout(disposeTimer);
    disposeTimer = null;
  }

  if (renderer) {
    if (contextLostHandler) {
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        contextLostHandler,
      );
      contextLostHandler = null;
    }
    renderer.dispose();
    renderer = null;
  }
  if (scene) {
    scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    scene = null;
  }
  camera = null;
  clearGltfCache();
  pendingByKey.clear();
  queue.length = 0;
  isProcessing = false;
}

// ── Render execution ─────────────────────────────────────────────────────────

/**
 * clone 고유 리소스만 해제한다.
 *
 * SkeletonUtils.clone은 geometry/material을 마스터(GLTF 캐시)와 **공유**하므로
 * 여기서 dispose하면 캐시에 살아 있는 마스터의 GPU 버퍼가 파괴된다 — 같은
 * 모델을 재요청하면 캐시 히트인데 버퍼는 이미 해제된 상태가 된다. clone이
 * 실제로 소유하는 것은 복제된 Skeleton(렌더 시 생성되는 boneTexture)뿐이다.
 * 공유 geometry/material의 해제는 clearGltfCache()가 담당한다.
 */
function disposeClone(obj: import('three').Object3D): void {
  obj.traverse((child) => {
    if ((child as SkinnedMesh).isSkinnedMesh) {
      (child as SkinnedMesh).skeleton.dispose();
    }
  });
}

async function executeRender(entry: QueueEntry): Promise<void> {
  const { request } = entry;

  if (entry.aborted) return;

  ensureRenderer();

  if (!renderer || !scene || !camera) {
    rejectListeners(entry, new Error('Renderer not initialized'));
    return;
  }

  try {
    const gltfScene = await loadGltfScene(request.path);

    if (entry.aborted) return;

    const clone = SkeletonUtils.clone(gltfScene);
    const group = new Group();
    group.add(clone);
    scene.add(group);

    try {
      renderer.setSize(request.width, request.height);
      camera.left = -request.width / 2;
      camera.right = request.width / 2;
      camera.top = request.height / 2;
      camera.bottom = -request.height / 2;
      camera.updateProjectionMatrix();

      frameCameraToModel(
        camera,
        group,
        request.width,
        request.height,
        request.preset,
      );
      renderer.render(scene, camera);
    } finally {
      scene.remove(group);
      disposeClone(clone);
    }

    const blobUrl = await new Promise<string>((res, rej) => {
      renderer!.domElement.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          res(url);
        } else {
          rej(new Error('toBlob returned null'));
        }
      }, 'image/png');
    });

    setCachedPreviewResult(request, blobUrl);
    resolveListeners(entry, blobUrl);
  } catch (err) {
    rejectListeners(entry, err instanceof Error ? err : new Error(String(err)));
  }
}

// ── Queue processing ─────────────────────────────────────────────────────────

function processNext(): void {
  if (isProcessing || queue.length === 0) return;

  const entry = queue.shift()!;
  pendingByKey.delete(getRenderRequestKey(entry.request));

  if (entry.aborted) {
    scheduleNext();
    return;
  }

  isProcessing = true;

  const scheduleIdle = (fn: () => void) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(fn, { timeout: 100 });
    } else {
      setTimeout(fn, 0);
    }
  };

  scheduleIdle(() => {
    const RENDER_TIMEOUT_MS = 30_000;

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Render timed out')),
        RENDER_TIMEOUT_MS,
      );
    });

    Promise.race([executeRender(entry), timeout])
      .catch((err) => {
        rejectListeners(
          entry,
          err instanceof Error ? err : new Error(String(err)),
        );
      })
      .finally(() => {
        isProcessing = false;
        scheduleNext();
      });
  });
}

function scheduleNext(): void {
  if (queue.length > 0 && !isProcessing) {
    processNext();
    return;
  }

  scheduleDispose();
}

export const enqueueRender = createEnqueueRender(
  pendingByKey,
  queue,
  scheduleNext,
);
