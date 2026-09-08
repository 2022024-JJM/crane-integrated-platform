import { useCallback, useEffect, useState } from 'react'

/**
 * 일정 주기로 증가하는 카운터 — `useAsyncData` 의 deps 에 넣어 재조회를 유발한다.
 *
 * `useClock` 을 쓰면 매초 렌더가 일어나 표가 통째로 다시 그려진다. 여기서는 갱신
 * 주기에만 한 번 값이 바뀌고, `bump()` 로 즉시 갱신도 시킬 수 있다.
 */
export function useIntervalTick(intervalMs: number, enabled: boolean) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => setTick((value) => value + 1), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs, enabled])

  const bump = useCallback(() => setTick((value) => value + 1), [])

  return { tick, bump }
}
