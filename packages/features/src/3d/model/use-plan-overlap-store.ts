import { create } from 'zustand';
import type { PlanOverlap } from '@crane/domain/3d';

/**
 * 평면도 겹침 상태 — Canvas 안 ScenePlanOverlapDetector 가 평면도 룩에서
 * 주기적으로 채우고, 모델 숨은선(outdoor-work-model-simulation →
 * GltfModel.planHiddenIndex)이 `hiddenIndexById` 를 읽는다. `overlaps` 는
 * 검출기의 변화 비교용이다. 원근으로 돌아오면 비운다. 리렌더를 아끼려
 * 숨은선 대상이 같은 결과는 쓰지 않는다(lib/plan-overlap.ts
 * isPlanOverlapListEqual — 검출기가 비교한다).
 */
interface PlanOverlapState {
  overlaps: readonly PlanOverlap[];
  /** 가려지는 모델 id → 숨은선 인덱스. 참조는 overlaps 와 함께만 바뀐다. */
  hiddenIndexById: ReadonlyMap<string, number>;
  set: (
    overlaps: readonly PlanOverlap[],
    hiddenIndexById: ReadonlyMap<string, number>,
  ) => void;
  clear: () => void;
}

const EMPTY_OVERLAPS: readonly PlanOverlap[] = Object.freeze([]);
const EMPTY_INDEX: ReadonlyMap<string, number> = new Map();

export const usePlanOverlapStore = create<PlanOverlapState>((set) => ({
  overlaps: EMPTY_OVERLAPS,
  hiddenIndexById: EMPTY_INDEX,
  set: (overlaps, hiddenIndexById) => set({ overlaps, hiddenIndexById }),
  clear: () =>
    set((state) =>
      state.overlaps.length === 0
        ? state
        : { overlaps: EMPTY_OVERLAPS, hiddenIndexById: EMPTY_INDEX },
    ),
}));
