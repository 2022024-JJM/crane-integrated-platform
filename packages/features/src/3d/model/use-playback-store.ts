import { create } from 'zustand';

/** 플레이백 페이지의 값 소스 — 기록 리플레이(서버 프레임) 또는 시뮬레이션(가상 태그). */
export type PlaybackSource = 'replay' | 'simulation';

interface PlaybackState {
  source: PlaybackSource;
  setSource: (source: PlaybackSource) => void;
}

/**
 * 플레이백 세션 상태 — 어느 소스가 활성인지. 세션 전용(저장 안 함).
 *
 * 의존성이 없는 작은 모듈로 둔다 — scene-collision-hold(러너 판정)와
 * playback-transport(어댑터) 양쪽이 읽는데, 어댑터가 충돌 스토어를 import
 * 하고 충돌 스토어가 hold 를 import 하므로 hold 가 어댑터를 보면 순환이다.
 */
export const usePlaybackStore = create<PlaybackState>()((set, get) => ({
  source: 'replay',
  setSource: (source) => {
    if (source === get().source) return;
    set({ source });
  },
}));
