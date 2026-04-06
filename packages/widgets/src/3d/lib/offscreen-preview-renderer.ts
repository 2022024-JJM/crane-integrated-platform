import {
  AmbientLight,
  Box3,
  Cache,
  CircleGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import type { SceneModelPreviewPreset } from '@crane/domain/3d';

Cache.enabled = true;

export interface RenderRequest {
  path: string;
  preset?: SceneModelPreviewPreset;
  width: number;
  height: number;
}

export interface AbortHandle {
  abort: () => void;
}

interface QueueListener {
  resolve: (url: string) => void;
  reject: (error: Error) => void;
  aborted: boolean;
}

interface QueueEntry {
  request: RenderRequest;
  listeners: QueueListener[];
  aborted: boolean;
}

// ── Shared state ──────────────────────────────────────────────────────────────

let renderer: WebGLRenderer | null = null;
let scene: Scene | null = null;
let camera: OrthographicCamera | null = null;
let refCount = 0;
let disposeTimer: ReturnType<typeof setTimeout> | null = null;
let isProcessing = false;

const loader = new GLTFLoader();

const GLTF_CACHE_MAX_SIZE = 50;
const gltfCache = new Map<string, Object3D>();

function gltfCacheGet(key: string): Object3D | undefined {
  const value = gltfCache.get(key);
  if (value !== undefined) {
    // Move to end (most recently used)
    gltfCache.delete(key);
    gltfCache.set(key, value);
  }
  return value;
}

function gltfCacheSet(key: string, value: Object3D): void {
  if (gltfCache.has(key)) {
    gltfCache.delete(key);
  } else if (gltfCache.size >= GLTF_CACHE_MAX_SIZE) {
    // Evict oldest (first entry)
    const oldest = gltfCache.keys().next().value;
    if (oldest !== undefined) {
      gltfCache.delete(oldest);
    }
  }
  gltfCache.set(key, value);
}

const blobUrls = new Set<string>();
const pendingByPath = new Map<string, QueueEntry>();
const queue: QueueEntry[] = [];

// ── Renderer lifecycle ────────────────────────────────────────────────────────

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
  // Reject all pending queue entries
  for (const entry of queue) {
    if (!entry.aborted) {
      rejectListeners(entry, new Error('WebGL context lost'));
    }
  }
  queue.length = 0;
  pendingByPath.clear();
  isProcessing = false;

  // Force renderer recreation on next request
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
  gltfCache.clear();

  for (const url of blobUrls) {
    URL.revokeObjectURL(url);
  }
  blobUrls.clear();
  pendingByPath.clear();
  queue.length = 0;
  isProcessing = false;
}

// ── Camera framing ────────────────────────────────────────────────────────────

function frameCameraToModel(
  cam: OrthographicCamera,
  group: Group,
  width: number,
  height: number,
  preset?: SceneModelPreviewPreset,
): void {
  const box = new Box3().setFromObject(group);

  if (box.isEmpty()) return;

  const center = new Vector3();
  const size = new Vector3();
  box.getSize(size);
  box.getCenter(center);

  const verticalOffset = size.y * (preset?.verticalOffsetRatio ?? 0);
  group.scale.setScalar(1);
  group.position.set(-center.x, -center.y + verticalOffset, -center.z);
  group.updateMatrixWorld(true);

  const target = new Vector3(0, 0, 0);
  const viewDirection = new Vector3(
    ...((preset?.cameraDirection ?? [1.16, 0.78, 1.16]) as [
      number,
      number,
      number,
    ]),
  ).normalize();
  const radius = size.length() * 0.5;
  const cameraDistance = Math.max(radius * 2.25, 3.5);

  cam.position.copy(target).add(viewDirection.multiplyScalar(cameraDistance));
  cam.near = 0.1;
  cam.far = Math.max(cameraDistance + radius * 4, 100);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);

  const fittedBox = new Box3().setFromObject(group);
  const corners = [
    new Vector3(fittedBox.min.x, fittedBox.min.y, fittedBox.min.z),
    new Vector3(fittedBox.min.x, fittedBox.min.y, fittedBox.max.z),
    new Vector3(fittedBox.min.x, fittedBox.max.y, fittedBox.min.z),
    new Vector3(fittedBox.min.x, fittedBox.max.y, fittedBox.max.z),
    new Vector3(fittedBox.max.x, fittedBox.min.y, fittedBox.min.z),
    new Vector3(fittedBox.max.x, fittedBox.min.y, fittedBox.max.z),
    new Vector3(fittedBox.max.x, fittedBox.max.y, fittedBox.min.z),
    new Vector3(fittedBox.max.x, fittedBox.max.y, fittedBox.max.z),
  ];

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const corner of corners) {
    const p = corner.clone().applyMatrix4(cam.matrixWorldInverse);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const up = new Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  group.position
    .sub(right.multiplyScalar(centerX))
    .sub(up.multiplyScalar(centerY));
  group.updateMatrixWorld(true);

  const projW = maxX - minX;
  const projH = maxY - minY;
  const paddingScale = preset?.paddingScale ?? 1.22;
  const paddedX = Math.max((projW / 2) * paddingScale, 0.001);
  const paddedY = Math.max((projH / 2) * paddingScale, 0.001);
  const zoomW = width / (paddedX * 2);
  const zoomH = height / (paddedY * 2);

  cam.zoom = Math.max(0.01, Math.min(zoomW, zoomH));
  cam.updateProjectionMatrix();
}

// ── Render execution ──────────────────────────────────────────────────────────

async function loadGltfScene(path: string): Promise<Object3D> {
  const cached = gltfCacheGet(path);
  if (cached) {
    return cached;
  }

  return new Promise<Object3D>((resolve, reject) => {
    loader.load(
      path,
      (gltf) => {
        gltfCacheSet(path, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      reject,
    );
  });
}

function disposeClone(obj: Object3D): void {
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

function resolveListeners(entry: QueueEntry, url: string): void {
  for (const listener of entry.listeners) {
    if (!listener.aborted) {
      listener.resolve(url);
    }
  }
}

function rejectListeners(entry: QueueEntry, error: Error): void {
  for (const listener of entry.listeners) {
    if (!listener.aborted) {
      listener.reject(error);
    }
  }
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
          const url = URL.createObjectURL(blob);
          blobUrls.add(url);
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

// ── Render queue ──────────────────────────────────────────────────────────────

function processNext(): void {
  if (isProcessing || queue.length === 0) return;

  const entry = queue.shift()!;
  pendingByPath.delete(entry.request.path);

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
    executeRender(entry).finally(() => {
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

export function enqueueRender(request: RenderRequest): {
  promise: Promise<string>;
  abort: AbortHandle;
} {
  // Return cached blob URL if already rendered
  // (cache is managed externally by the hook to avoid path+preset key complexity here)

  // Dedup: if same path already in queue, append listener to existing entry
  const existing = pendingByPath.get(request.path);
  if (existing && !existing.aborted) {
    const listener: QueueListener = {
      resolve: () => {},
      reject: () => {},
      aborted: false,
    };
    const promise = new Promise<string>((resolve, reject) => {
      listener.resolve = resolve;
      listener.reject = reject;
    });
    existing.listeners.push(listener);

    return {
      promise,
      abort: {
        abort: () => {
          listener.aborted = true;
          // If all listeners are aborted, mark the entire entry as aborted
          if (existing.listeners.every((l) => l.aborted)) {
            existing.aborted = true;
          }
        },
      },
    };
  }

  const listener: QueueListener = {
    resolve: () => {},
    reject: () => {},
    aborted: false,
  };
  const promise = new Promise<string>((resolve, reject) => {
    listener.resolve = resolve;
    listener.reject = reject;
  });

  const entry: QueueEntry = {
    request,
    listeners: [listener],
    aborted: false,
  };
  queue.push(entry);
  pendingByPath.set(request.path, entry);

  scheduleNext();

  return {
    promise,
    abort: {
      abort: () => {
        listener.aborted = true;
        if (entry.listeners.every((l) => l.aborted)) {
          entry.aborted = true;
        }
      },
    },
  };
}
