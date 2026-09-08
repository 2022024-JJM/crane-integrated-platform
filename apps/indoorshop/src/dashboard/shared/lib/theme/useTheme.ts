import { useTheme as useShellTheme } from '@crane/core/lib/theme-context'
import type { ThemeContextType } from './context'

/**
 * 테마는 셸의 ThemeProvider 하나만 쓴다.
 *
 * 원본은 자체 ThemeProvider 로 `<html>` 의 `dark` 클래스를 직접 토글했는데,
 * 셸의 AppLayout 도 같은 클래스를 같은 localStorage 키('theme')로 관리한다.
 * 둘을 함께 띄우면 두 provider 가 서로의 클래스를 되돌려 테마가 튄다.
 *
 * 그래서 이쪽은 셸 컨텍스트로 넘기는 얇은 어댑터로만 남긴다. 원본의 'system'
 * 선택지는 셸에 없으므로 노출하지 않는다 — 셸이 초기값을 정할 때 이미 OS
 * 설정을 따르고 있어, 실제로 빠지는 기능은 "이후 OS 변경 실시간 추종" 뿐이다.
 */
export function useTheme(): ThemeContextType {
  const { theme, setTheme } = useShellTheme()

  return {
    theme,
    setTheme: (next) => {
      if (next === 'system') {
        setTheme(
          window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        )
        return
      }
      setTheme(next)
    },
  }
}
