import { Mesh, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { withBaseUrl } from '@crane/domain/3d';

const GLTF_CACHE_MAX_SIZE = 50;

const loader = new GLTFLoader();
const gltfCache = new Map<string, Object3D>();

function disposeObject3D(obj: Object3D): void {
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
      // LRU eviction: outflight clone들이 master geometry/material을 공유할 수 있어
      // 즉시 dispose하지 않고 reference만 끊는다. clone은 자체 disposeClone으로 정리되며,
      // master는 GC로 회수된다 (참조가 끊겼을 때).
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
      withBaseUrl(path),
      (gltf) => {
        gltfCacheSet(path, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      reject,
    );
  });
}

/**
 * 캐시 전체 정리. renderer dispose 시점에만 호출되며, outflight clone이 없는
 * 상황을 가정하므로 master를 traverse-dispose하여 GPU 자원을 즉시 회수한다.
 */
export function clearGltfCache(): void {
  for (const value of gltfCache.values()) {
    disposeObject3D(value);
  }
  gltfCache.clear();
}
