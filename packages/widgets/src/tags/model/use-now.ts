import { useEffect, useState } from 'react';

/**
 * 벽시계 틱 — 경과 시간("n초 전")·상태 점 판정처럼 시간이 흐르면 바뀌는
 * 표시를 주기적으로 다시 그리게 한다. 값 수신과 무관하게 돈다.
 */
export function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
