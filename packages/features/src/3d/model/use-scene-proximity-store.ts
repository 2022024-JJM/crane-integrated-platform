import { create } from 'zustand';
import {
  isProximityOutlineEqual,
  isProximityPairsEqual,
  type ProximityPair,
} from '../lib/scene-proximity';

/**
 * 근접 쌍 목록 — 충돌 런타임의 모델 AABB 간격에서 뽑는다(use-scene-proximity).
 * PROXIMITY_UPDATE_MS 마다 갱신하되 표시가 실제로 바뀔 때만 set 한다
 * (isProximityPairsEqual) — 선·라벨·외곽선이 React 요소라 매 갱신이 커밋이다.
 */
interface SceneProximityState {
  pairs: ProximityPair[];
  /** 키·등급이 바뀔 때만 참조가 바뀌는 사본 — 외곽선·맥동 등 "어느 쌍" 만 필요한 구독자용. */
  outlinePairs: ProximityPair[];
  setPairs: (next: ProximityPair[]) => void;
  clear: () => void;
}

const EMPTY: ProximityPair[] = [];

export const useSceneProximityStore = create<SceneProximityState>()(
  (set, get) => ({
    pairs: EMPTY,
    outlinePairs: EMPTY,
    setPairs: (next) => {
      const { pairs, outlinePairs } = get();
      if (isProximityPairsEqual(pairs, next)) return;
      set(
        isProximityOutlineEqual(outlinePairs, next)
          ? { pairs: next }
          : { pairs: next, outlinePairs: next },
      );
    },
    clear: () => {
      if (get().pairs.length > 0) set({ pairs: EMPTY, outlinePairs: EMPTY });
    },
  }),
);
