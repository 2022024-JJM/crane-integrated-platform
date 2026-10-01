import { useEffect, useState } from 'react';

/**
 * 값이 `delayMs` 동안 바뀌지 않았는가. 방향키로 목록을 빠르게 넘길 때 지나치는
 * 자산마다 무거운 일(3D 파일 내려받기·캔버스 만들기)을 시작하지 않게 한다.
 */
export function useSettled<T>(value: T, delayMs: number): boolean {
  const [settled, setSettled] = useState<{ value: T } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled({ value }), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);
  return settled !== null && Object.is(settled.value, value);
}
