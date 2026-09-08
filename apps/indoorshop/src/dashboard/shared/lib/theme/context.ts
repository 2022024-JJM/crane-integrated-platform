import { createContext } from 'react'
import type { Theme } from './storage'

export interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

/*
 * 컨텍스트를 컴포넌트와 같은 파일에 두면 fast-refresh 가 동작하지 않는다.
 * 또한 테마는 특정 화면이 아니라 앱 전체의 기반이라 shared 에 둔다 —
 * app 에 두면 shared·widgets 가 상위 레이어를 거꾸로 참조하게 된다.
 */
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)
