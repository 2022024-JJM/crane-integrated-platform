import { Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const GLTF_CACHE_MAX_SIZE = 50;

const loader = new GLTFLoader();
const gltfCache = new Map<string, Object3D>();

function gltfCacheGet(key: string): Object3D | undefined {
  const value = gltfCache.get(key);
  if (value !== undefined) {
    gltfCache.delete(key);
    gltfCache.set(key, value);
  }
  return value;
}

function gltfCacheSet(key: string, value: Object3D): void {
  if (gltfCache.has(key)) {
    gltfCache.delete(key);
  } else if (gltfCache.size >= GLTF_CACHE_MAX_SIZE) {
    const oldest = gltfCache.keys().next().value;
    if (oldest !== undefined) {
      gltfCache.delete(oldest);
    }
  }
  gltfCache.set(key, value);
}

export function loadGltfScene(path: string): Promise<Object3D> {
  const cached = gltfCacheGet(path);
  if (cached) {
    return Promise.resolve(cached);
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

export function clearGltfCache(): void {
  gltfCache.clear();
}
