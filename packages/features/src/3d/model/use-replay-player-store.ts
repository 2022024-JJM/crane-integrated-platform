import { create } from 'zustand';
import type { ReplayLiteFrame } from '@crane/domain/monitoring';
import { useValueMapperStore } from './use-value-mapper-store';


interface ReplayPlayerState {
  frames: ReplayLiteFrame[];
  intervalMs: number;
  frameIndex: number;
  isPlaying: boolean;
  speedMultiplier: number;

  loadFrames: (frames: ReplayLiteFrame[], intervalMs: number) => void;
  play: () => void;
  pause: () => void;
  seekTo: (index: number) => void;
  setSpeed: (speed: number) => void;
  /**
   * R3F useFrame 루프에서 호출된다.
   * 현재 프레임의 크레인 값을 ValueMapper에 적용하고 다음 프레임으로 이동한다.
   * tick 내부의 Object3D mutate는 zustand set()을 호출하지 않는다.
   * frameIndex 갱신만 set()으로 처리해 UI 컨트롤(타임라인)이 반응할 수 있게 한다.
   */
  tick: () => void;
  reset: () => void;
}

export const useReplayPlayerStore = create<ReplayPlayerState>()((set, get) => ({
  frames: [],
  intervalMs: 5_000,
  frameIndex: 0,
  isPlaying: false,
  speedMultiplier: 1,

  loadFrames: (frames, intervalMs) => {
    // 새 구간 로드 시 이전 위치 초기화
    useValueMapperStore.getState().resetToOrigin();
    set({ frames, intervalMs, frameIndex: 0, isPlaying: false });
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),

  seekTo: (index) => {
    const { frames } = get();
    const clamped = Math.max(0, Math.min(index, frames.length - 1));
    // 0으로 이동 시 원위치 먼저 복귀 후 첫 프레임 적용
    if (clamped === 0) {
      useValueMapperStore.getState().resetToOrigin();
    }
    set({ frameIndex: clamped, isPlaying: false });

    // seek 위치의 프레임 값을 즉시 3D에 반영
    const frame = frames[clamped];
    if (!frame) return;
    const applyValue = useValueMapperStore.getState().applyValue;
    for (const crane of frame.cranes) {
      const craneId = crane.craneId.replace(/-/g, '_');
      for (const [tagCode, value] of Object.entries(crane.values)) {
        if (typeof value !== 'number') continue;
        applyValue(`${craneId}:${tagCode}`, value);
      }
    }
  },

  setSpeed: (speed) => set({ speedMultiplier: speed }),

  tick: () => {
    const { frames, frameIndex } = get();
    const frame = frames[frameIndex];
    if (!frame) return;

    const applyValue = useValueMapperStore.getState().applyValue;
    for (const crane of frame.cranes) {
      const craneId = crane.craneId.replace(/-/g, '_');
      for (const [tagCode, value] of Object.entries(crane.values)) {
        if (typeof value !== 'number') continue;
        applyValue(`${craneId}:${tagCode}`, value);
      }
    }

    const next = frameIndex + 1;
    if (next >= frames.length) {
      set({ isPlaying: false });
      return;
    }
    set({ frameIndex: next });
  },

  reset: () =>
    set({ frames: [], intervalMs: 5_000, frameIndex: 0, isPlaying: false }),
}));
