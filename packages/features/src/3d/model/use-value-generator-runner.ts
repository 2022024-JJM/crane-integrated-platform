import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useValueGeneratorStore } from './use-value-generator-store';

/**
 * 시뮬레이션 값 생성기를 R3F 렌더 루프(useFrame)에 동기화한다.
 *
 * 이전 구현은 setInterval(100ms)였는데:
 *  1) requestAnimationFrame과 비동기라 프레임 경계에서 jitter 발생,
 *  2) 매 tick마다 zustand `set()`을 호출 → 모든 subscribers 리렌더로
 *     scene 트리 reconcile 비용이 누적,
 *  3) interval이 frame budget(16.67ms)와 어긋남.
 *
 * 현재 구현은:
 *  - useFrame delta(ms)를 누적해 설정된 interval마다 1회 tick.
 *  - tick 내부는 Object3D를 직접 mutate(zustand set 호출 없음).
 *  - 컴포넌트는 R3F Canvas 안에서만 사용해야 한다.
 */
export function useValueGeneratorRunner() {
  const interval = useValueGeneratorStore((s) => s.interval);
  const isRunning = useValueGeneratorStore((s) => s.isRunning);

  const accumulatorRef = useRef(0);

  useFrame((_, delta) => {
    if (!isRunning) {
      accumulatorRef.current = 0;
      return;
    }

    accumulatorRef.current += delta * 1000;

    if (accumulatorRef.current < interval) {
      return;
    }

    // 한 프레임에서 너무 많이 밀린 경우(탭 비활성 등) 한 번만 따라잡는다.
    accumulatorRef.current = 0;
    useValueGeneratorStore.getState().tick();
  });
}
