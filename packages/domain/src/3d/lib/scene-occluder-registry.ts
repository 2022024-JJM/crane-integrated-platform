import type { Object3D, Scene } from 'three';

/**
 * 센서(LIDAR/Camera) raycast 대상 mesh 등록부.
 *
 * 모델이 mount될 때 자기 mesh들을 등록하고, unmount 시 제거한다. 센서는
 * 매 frame 이 등록부에서 occluder 목록을 가져와 raycast 한다. WeakMap 키
 * 가 Scene 객체라 R3F가 Canvas를 unmount 하면 자동으로 GC 된다.
 *
 * dirty 플래그 + revision 카운터:
 *   - dirty: cachedMeshes 재구성이 필요한지 (등록/해제 시 set)
 *   - revision: 변경 추적용. 센서가 dirty-check token으로 사용 (revision이
 *     같으면 occluder 목록이 안 변했다는 뜻 → raycast 재계산 skip 가능)
 */
interface SceneOccluderRegistryEntry {
  cachedMeshes: Object3D[];
  dirty: boolean;
  meshesByOwner: Map<string, Object3D[]>;
  revision: number;
}

const sceneOccluderRegistry = new WeakMap<Scene, SceneOccluderRegistryEntry>();

function getOrCreateSceneEntry(scene: Scene) {
  let entry = sceneOccluderRegistry.get(scene);
  if (entry) return entry;
  entry = {
    cachedMeshes: [],
    dirty: false,
    meshesByOwner: new Map(),
    revision: 0,
  };
  sceneOccluderRegistry.set(scene, entry);
  return entry;
}

export function registerSceneOccluders(
  scene: Scene,
  ownerId: string,
  meshes: Object3D[],
) {
  const entry = getOrCreateSceneEntry(scene);
  entry.meshesByOwner.set(ownerId, meshes);
  entry.dirty = true;
  entry.revision += 1;
}

export function unregisterSceneOccluders(scene: Scene, ownerId: string) {
  const entry = sceneOccluderRegistry.get(scene);
  if (!entry || !entry.meshesByOwner.delete(ownerId)) return;
  entry.dirty = true;
  entry.revision += 1;
  if (entry.meshesByOwner.size === 0) {
    entry.cachedMeshes = [];
  }
}

export function getSceneOccluders(scene: Scene): {
  meshes: Object3D[];
  revision: number;
} {
  const entry = getOrCreateSceneEntry(scene);
  if (entry.dirty) {
    entry.cachedMeshes = Array.from(entry.meshesByOwner.values()).flat();
    entry.dirty = false;
  }
  return { meshes: entry.cachedMeshes, revision: entry.revision };
}
