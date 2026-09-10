import { useEffect, useState } from 'react';

/**
 * 현재 시각(ms)을 React 상태로 공급하는 폴링 훅. 렌더 중 `Date.now()` 호출은
 * react-hooks purity 규칙 위반이라, 시각이 필요한 곳(일별 버킷의 `now`,
 * 라이브 태그 stale 판정)은 이 훅으로 받는다. 틱 자체가 리렌더를 만들므로
 * tagLiveValues 같은 mutable 캐시 폴링 용도도 겸한다.
 */
export function useNowTick(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}
