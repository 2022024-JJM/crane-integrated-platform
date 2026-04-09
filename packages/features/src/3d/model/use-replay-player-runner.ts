import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useReplayPlayerStore } from './use-replay-player-store';

/**
 * 리플레이 플레이어를 R3F 렌더 루프(useFrame)에 동기화한다.
 *
 * - useFrame delta(ms)를 누적해 (intervalMs / speedMultiplier)마다 1회 tick.
 * - tick 내부는 Object3D를 직접 mutate(zustand set 최소화).
 * - 컴포넌트는 R3F Canvas 안에서만 사용해야 한다.
 */
export function useReplayPlayerRunner() {
  const intervalMs = useReplayPlayerStore((s) => s.intervalMs);
  const isPlaying = useReplayPlayerStore((s) => s.isPlaying);
  const speedMultiplier = useReplayPlayerStore((s) => s.speedMultiplier);

  const accumulatorRef = useRef(0);

  useFrame((_, delta) => {
    if (!isPlaying) {
      accumulatorRef.current = 0;
      return;
    }

    accumulatorRef.current += delta * 1000;

    const effectiveInterval = intervalMs / speedMultiplier;
    if (accumulatorRef.current < effectiveInterval) {
      return;
    }

    // 탭 비활성 등으로 delta가 크게 밀린 경우 한 번만 따라잡는다.
    accumulatorRef.current = 0;
    useReplayPlayerStore.getState().tick();
  });
}
