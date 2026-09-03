import { create } from 'zustand';
import type { Vector3Tuple } from '@crane/core/types/math';

/** 포커스 진입 직전 카메라 포즈 — 돌아가기 때 이 시점으로 복귀한다. */
export interface FocusCameraPose {
  position: Vector3Tuple;
  target: Vector3Tuple;
}

/**
 * 모니터링 씬의 모델 포커스 상태. 포커스는 "진입 → 돌아가기" 한 쌍으로만
 * 동작하며 중첩되지 않는다 — 포커스 중 다른 모델을 클릭해도 enterFocus 는
 * no-op 이라 먼저 돌아가기로 빠져나와야 한다.
 *
 * 흐림(투명도)은 여기 저장하지 않는다. 씬 데이터의 opacity 를 단일 소스로
 * 두고 렌더 시 파생한다(lib/focus-ghost.ts) — 해제는 prop 이 원래 값으로
 * 돌아가는 것 자체다.
 */
interface ObjectFocusState {
  focusedModelId: string | null;
  /**
   * 포커스 진입 직전 카메라 포즈. null 이면(컨트롤러 미준비 등) 해제 시
   * 씬 기본 카메라로 리셋한다. exitFocus 가 함께 비우므로 해제 시점의 포즈는
   * subscribe 의 prev 상태에서 읽는다(outdoor-work-model-simulation).
   */
  returnPose: FocusCameraPose | null;
  /** 이미 포커스 중이면 no-op — 1단계 제한의 불변식. */
  enterFocus: (id: string, returnPose: FocusCameraPose | null) => void;
  /** 포커스가 없으면 no-op(상태 참조 유지). */
  exitFocus: () => void;
}

export const useObjectFocusStore = create<ObjectFocusState>()((set, get) => ({
  focusedModelId: null,
  returnPose: null,
  enterFocus: (id, returnPose) => {
    if (get().focusedModelId !== null) {
      return;
    }
    set({ focusedModelId: id, returnPose });
  },
  exitFocus: () => {
    if (get().focusedModelId === null) {
      return;
    }
    set({ focusedModelId: null, returnPose: null });
  },
}));
