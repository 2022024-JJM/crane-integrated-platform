import { useEffect, useState } from 'react'

/**
 * 켜진 뒤 `delayMs` 를 넘게 유지될 때에만 true 가 되는 플래그.
 *
 * 로딩이 150ms 만에 끝나는데 스피너를 바로 띄우면 그 자체가 깜박임이다 —
 * 사람이 "기다린다"고 느끼기 시작하는 지점 이후에만 표시를 낸다.
 */
export function useDelayedFlag(active: boolean, delayMs = 220): boolean {
  const [raised, setRaised] = useState(false)

  useEffect(() => {
    if (!active) {
      setRaised(false)
      return
    }
    const timer = setTimeout(() => setRaised(true), delayMs)
    return () => clearTimeout(timer)
  }, [active, delayMs])

  return raised
}
