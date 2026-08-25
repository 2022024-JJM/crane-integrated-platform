import { useEffect, useState } from 'react'
import { getEffectiveTheme } from './storage'
import { useTheme } from './useTheme'

/**
 * 지금 화면에 **실제로** 적용된 밝기.
 *
 * `useTheme()` 이 주는 값은 사용자가 고른 것(`light`/`dark`/`system`)이라, 그대로 쓰면
 * `system` 을 고른 사람에게 어느 쪽인지 답하지 못한다. 게다가 `system` 은 앱이 켜져 있는
 * 동안에도 바뀌므로(OS 가 해질녘에 다크로 넘긴다), 한 번 읽고 마는 값이어서는 안 된다.
 *
 * CSS 는 `html.dark` 클래스 하나로 이 문제를 넘기지만, 캔버스·SVG 처럼 **JS 가 색을
 * 직접 고르는 곳**은 값으로 알아야 한다. 그래서 구독까지 포함해 여기 한 번만 둔다.
 */
export function useEffectiveTheme(): 'light' | 'dark' {
  const { theme } = useTheme()
  const [effective, setEffective] = useState(() => getEffectiveTheme(theme))

  useEffect(() => {
    setEffective(getEffectiveTheme(theme))
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setEffective(media.matches ? 'dark' : 'light')
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [theme])

  return effective
}
