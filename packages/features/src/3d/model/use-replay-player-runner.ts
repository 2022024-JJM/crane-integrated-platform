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
  const lastFrameIndexRef = useRef(frameIndex);
  const lastSpeedRef = useRef(speedMultiplier);

  useFrame((_, delta) => {
    if (!isPlaying) {
      accumulatorRef.current = 0;
      lastFrameIndexRef.current = frameIndex;
      lastSpeedRef.current = speedMultiplier;
      return;
    }

    // seek(외부 frameIndex 변경) 또는 속도 변경 감지 시 누적기 리셋.
    // 잔여 누적값을 새 interval로 평가하면 frame이 비정상적으로 길거나 짧게 머무름.
    if (
      lastFrameIndexRef.current !== frameIndex ||
      lastSpeedRef.current !== speedMultiplier
    ) {
      accumulatorRef.current = 0;
      lastFrameIndexRef.current = frameIndex;
      lastSpeedRef.current = speedMultiplier;
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
    // tick()이 store의 frameIndex를 갱신했으므로(또는 마지막 프레임에서 그대로 유지),
    // 다음 useFrame 진입 시 reset 분기가 트리거되지 않도록 store 최신값과 동기화.
    lastFrameIndexRef.current = useReplayPlayerStore.getState().frameIndex;
  });
}
