import type { Object3D } from 'three';

/**
 * 3D 씬에 마운트된 모델 Object3D를 id로 O(1) 조회할 수 있도록 보관하는
 * 전역 mutable registry. zustand store가 아니라 Map이므로 React 리렌더를
 * 일으키지 않는다. value-mapper의 매 tick lookup, focus, 카메라 핏 등에서
 * `scene.getObjectByName()`(O(N)) 대신 사용한다.
 *
 * 사용 규칙:
 * - ModelMesh / SceneText 가 mount 시 register, unmount 시 unregister.
 * - 동일 id 재등록은 마지막 등록을 우선한다 (replace).
 * - 절대 객체를 외부에서 mutate한 뒤 register 해제 없이 dispose 하지 말 것.
 */
const registry = new Map<string, Object3D>();

export const modelObjectRegistry = {
  register(id: string, object: Object3D): void {
    registry.set(id, object);
  },
  unregister(id: string, object?: Object3D): void {
    // object가 주어지면 동일 참조일 때만 삭제 (race-safe).
    if (object && registry.get(id) !== object) {
      return;
    }
    registry.delete(id);
  },
  get(id: string): Object3D | undefined {
    return registry.get(id);
  },
  clear(): void {
    registry.clear();
  },
  get size(): number {
    return registry.size;
  },
};
