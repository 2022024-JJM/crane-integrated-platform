import { create } from 'zustand';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 드래그 중인 객체의 transient transform store.
 *
 * TransformControls가 매 frame Object3D를 mutate하는 동안 이 store에만 publish
 * 한다. sceneInfo는 mouseUp에서 단 한 번 commit하므로 그 사이에 ModelMesh
 * meshOverrides effect, R3F prop reconcile, palette 리렌더 등이 트리거되지
 * 않는다. Inspector만 이 store를 구독해 숫자를 실시간으로 표시한다.
 *
 * - active=true: 드래그 진행 중. position/rotation/scale은 publish 직후 값.
 * - active=false: 드래그 아님. 모든 값 null. Inspector는 sceneInfo의 값을 표시.
 */
interface ActiveTransformState {
  active: boolean;
  position: Vector3Tuple | null;
  /** degrees, Inspector 표시 단위와 동일 */
  rotation: Vector3Tuple | null;
  scale: Vector3Tuple | null;
  begin: () => void;
  publish: (
    position: Vector3Tuple,
    rotation: Vector3Tuple,
    scale: Vector3Tuple,
  ) => void;
  end: () => void;
}

export const useActiveTransformStore = create<ActiveTransformState>()((set) => ({
  active: false,
  position: null,
  rotation: null,
  scale: null,
  begin: () =>
    set({ active: true, position: null, rotation: null, scale: null }),
  publish: (position, rotation, scale) =>
    set({ active: true, position, rotation, scale }),
  end: () =>
    set({ active: false, position: null, rotation: null, scale: null }),
}));

/** 드래그 진행 여부만 boolean으로 구독한다. */
export function useIsTransformDragActive(): boolean {
  return useActiveTransformStore((s) => s.active);
}
