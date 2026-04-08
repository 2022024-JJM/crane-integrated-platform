import {
  AmbientLight,
  Cache,
  CircleGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
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

export type { RenderRequest, AbortHandle } from './preview-render-queue';

Cache.enabled = true;

// ── Shared state ─────────────────────────────────────────────────────────────

let renderer: WebGLRenderer | null = null;
let scene: Scene | null = null;
let camera: OrthographicCamera | null = null;
let refCount = 0;
let disposeTimer: ReturnType<typeof setTimeout> | null = null;
let isProcessing = false;

const blobUrls = new Set<string>();
const blobUrlsByPath = new Map<string, string>();
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

  r.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    handleContextLost();
  });

  return r;
}

function createScene(): Scene {
  const s = new Scene();

  const ambient = new AmbientLight(0xffffff, 2.4);
  s.add(ambient);

  const dir1 = new DirectionalLight(0xffffff, 4.4);
  dir1.position.set(3, 4, 2);
  s.add(dir1);

  const dir2 = new DirectionalLight(0x93c5fd, 1.2);
  dir2.position.set(-2, 2, -3);
  s.add(dir2);

  const groundGeo = new CircleGeometry(2.5, 48);
  const groundMat = new MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.92,
    metalness: 0.05,
  });
  const ground = new Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.25;
  s.add(ground);

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

  for (const url of blobUrls) {
    URL.revokeObjectURL(url);
  }
  blobUrls.clear();
  blobUrlsByPath.clear();

  renderer = null;
  scene = null;
  camera = null;
}

export function acquireRenderer(): void {
  if (disposeTimer !== null) {
    clearTimeout(disposeTimer);
    disposeTimer = null;
  }

  refCount++;

  if (!renderer) {
    renderer = createRenderer();
    scene = createScene();
    camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  }
}

export function releaseRenderer(): void {
  refCount = Math.max(0, refCount - 1);

  if (refCount === 0) {
    disposeTimer = setTimeout(() => {
      disposeAll();
    }, 5000);
  }
}

function disposeAll() {
  if (renderer) {
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

  for (const url of blobUrls) {
    URL.revokeObjectURL(url);
  }
  blobUrls.clear();
  blobUrlsByPath.clear();
  pendingByKey.clear();
  queue.length = 0;
  isProcessing = false;
}

// ── Render execution ─────────────────────────────────────────────────────────

function disposeClone(obj: import('three').Object3D): void {
  obj.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

async function executeRender(entry: QueueEntry): Promise<void> {
  const { request } = entry;

  if (entry.aborted) return;

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
          const previousUrl = blobUrlsByPath.get(request.path);
          if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
            blobUrls.delete(previousUrl);
          }
          const url = URL.createObjectURL(blob);
          blobUrls.add(url);
          blobUrlsByPath.set(request.path, url);
          res(url);
        } else {
          rej(new Error('toBlob returned null'));
        }
      }, 'image/png');
    });

    resolveListeners(entry, blobUrl);
  } catch (err) {
    rejectListeners(
      entry,
      err instanceof Error ? err : new Error(String(err)),
    );
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
  }
}

export const enqueueRender = createEnqueueRender(
  pendingByKey,
  queue,
  scheduleNext,
);
