import { createContext } from 'react'
import type { FontScale } from './storage'

export interface FontScaleContextType {
  fontScale: FontScale
  setFontScale: (scale: FontScale) => void
}

/*
 * 테마와 같은 이유로 컴포넌트 파일과 분리한다 (fast-refresh).
 * 글자 크기도 앱 전체의 기반이라 shared 에 둔다.
 */
export const FontScaleContext = createContext<FontScaleContextType | undefined>(undefined)
