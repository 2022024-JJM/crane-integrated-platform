import { useCallback } from 'react'
import { useTranslation } from './useTranslation'
import { LANGUAGE_LOCALE, type Language } from './config'

export interface LanguageState {
  language: Language
  setLanguage: (language: Language) => void
  /** `toLocaleString` 계열에 넘길 로케일 (예: `ko-KR`) */
  locale: string
}

/**
 * 현재 언어와 전환 함수.
 *
 * 테마·글자 크기와 같은 모양(`useTheme` / `useFontScale`)으로 맞춘다 — 설정 세 가지가
 * 서로 다른 방식으로 읽히면 화면 쪽 코드가 매번 달라진다.
 */
export function useLanguage(): LanguageState {
  const { i18n } = useTranslation()
  const language = (i18n.resolvedLanguage ?? 'ko') as Language

  const setLanguage = useCallback(
    (next: Language) => {
      void i18n.changeLanguage(next)
    },
    [i18n]
  )

  return { language, setLanguage, locale: LANGUAGE_LOCALE[language] }
}
