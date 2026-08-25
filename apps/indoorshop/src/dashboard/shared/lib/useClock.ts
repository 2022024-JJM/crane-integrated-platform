import { useEffect, useState } from 'react'

/**
 * 일정 주기로 갱신되는 현재 시각을 돌려준다.
 *
 * 렌더 시점에 `new Date()`를 한 번만 찍으면 값이 멈춰 있어 데이터 갱신 시각처럼
 * 오해를 부른다. 이 훅은 실제로 흘러가는 시계를 제공한다.
 */
export function useClock(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}
