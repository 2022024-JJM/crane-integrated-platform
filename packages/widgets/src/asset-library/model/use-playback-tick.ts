import { useEffect, useReducer } from 'react';

/**
 * 재생 중 일정 간격으로 다시 그리게 하는 틱. 재생 시각은 매 프레임 바뀌는
 * 시계에 있어 React 상태로 들지 않고 폴링으로 읽는다(3D 플레이 트랜스포트
 * 바와 같다). `bump` 는 이동 직후처럼 다음 틱을 기다리지 않고 바로 다시
 * 읽게 할 때 쓴다.
 */
export function usePlaybackTick(
  active: boolean,
  intervalMs: number,
): [tick: number, bump: () => void] {
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(bump, intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return [tick, bump];
}
