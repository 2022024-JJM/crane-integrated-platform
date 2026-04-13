import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useReplayPlayerStore } from './use-replay-player-store';

const DEFAULT_REPLAY_FRAME_DURATION_MS = 5_000;

export function useReplayPlayerRunner() {
  const frameDurationsMs = useReplayPlayerStore((s) => s.frameDurationsMs);
  const frameIndex = useReplayPlayerStore((s) => s.frameIndex);
  const isPlaying = useReplayPlayerStore((s) => s.isPlaying);
  const speedMultiplier = useReplayPlayerStore((s) => s.speedMultiplier);

  const accumulatorRef = useRef(0);

  useFrame((_, delta) => {
    if (!isPlaying) {
      accumulatorRef.current = 0;
      return;
    }

    accumulatorRef.current += delta * 1000;

    const frameDurationMs =
      frameDurationsMs[frameIndex] ?? DEFAULT_REPLAY_FRAME_DURATION_MS;
    const effectiveInterval = frameDurationMs / speedMultiplier;

    if (accumulatorRef.current < effectiveInterval) {
      return;
    }

    accumulatorRef.current = 0;
    useReplayPlayerStore.getState().tick();
  });
}
