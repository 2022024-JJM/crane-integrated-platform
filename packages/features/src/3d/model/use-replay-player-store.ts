import { create } from 'zustand';
import type { ReplayLiteFrame } from '@crane/domain/monitoring';
import { useValueMapperStore } from './use-value-mapper-store';

const DEFAULT_REPLAY_FRAME_DURATION_MS = 5_000;

function applyReplayFrame(frame: ReplayLiteFrame | undefined) {
  if (!frame) {
    return;
  }

  const applyValue = useValueMapperStore.getState().applyValue;

  for (const crane of frame.cranes) {
    const craneId = crane.craneId.replace(/-/g, '_');

    for (const [tagCode, value] of Object.entries(crane.values)) {
      if (typeof value !== 'number') {
        continue;
      }

      applyValue(`${craneId}:${tagCode}`, value);
    }
  }
}

interface ReplayPlayerState {
  frames: ReplayLiteFrame[];
  frameDurationsMs: number[];
  frameIndex: number;
  isPlaying: boolean;
  speedMultiplier: number;

  loadFrames: (frames: ReplayLiteFrame[], frameDurationsMs: number[]) => void;
  play: () => void;
  pause: () => void;
  seekTo: (index: number) => void;
  setSpeed: (speed: number) => void;
  tick: () => void;
  reset: () => void;
}

export const useReplayPlayerStore = create<ReplayPlayerState>()((set, get) => ({
  frames: [],
  frameDurationsMs: [],
  frameIndex: 0,
  isPlaying: false,
  speedMultiplier: 1,

  loadFrames: (frames, frameDurationsMs) => {
    useValueMapperStore.getState().resetToOrigin();

    const normalizedDurations =
      frameDurationsMs.length === frames.length
        ? frameDurationsMs
        : new Array<number>(frames.length).fill(DEFAULT_REPLAY_FRAME_DURATION_MS);

    set({
      frames,
      frameDurationsMs: normalizedDurations,
      frameIndex: 0,
      isPlaying: false,
    });

    applyReplayFrame(frames[0]);
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),

  seekTo: (index) => {
    const { frames } = get();
    const clamped = Math.max(0, Math.min(index, frames.length - 1));

    useValueMapperStore.getState().resetToOrigin();
    set({ frameIndex: clamped, isPlaying: false });
    applyReplayFrame(frames[clamped]);
  },

  setSpeed: (speed) => set({ speedMultiplier: speed }),

  tick: () => {
    const { frames, frameIndex } = get();
    const nextFrameIndex = frameIndex + 1;

    if (nextFrameIndex >= frames.length) {
      set({ isPlaying: false });
      return;
    }

    set({ frameIndex: nextFrameIndex });
    applyReplayFrame(frames[nextFrameIndex]);
  },

  reset: () => {
    useValueMapperStore.getState().resetToOrigin();
    set({
      frames: [],
      frameDurationsMs: [],
      frameIndex: 0,
      isPlaying: false,
    });
  },
}));
