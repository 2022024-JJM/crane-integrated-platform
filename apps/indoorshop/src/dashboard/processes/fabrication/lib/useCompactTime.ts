import { useCallback, useMemo } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { useLanguage } from '../../../shared/lib/i18n/useLanguage'

/**
 * 표 안에 들어가는 시각 — `useTimeFormat().absolute` 는 "9월 8일 오전 09:02:11" 처럼 길어
 * 열 열 개짜리 대조표에서는 한 칸이 두 줄로 접힌다. 여기서는 `09-08 09:02:11` 로 고정한다.
 * 툴팁에는 ISO 원문을 그대로 실어 초 단위 아래를 대조할 수 있게 한다.
 */
export function useCompactTime() {
  const { t } = useTranslation()
  const { locale } = useLanguage()

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
    [locale]
  )

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }),
    [locale]
  )

  const time = useCallback(
    (iso: string | null | undefined) => {
      if (!iso) return t('common.none')
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return iso
      return formatter.format(date)
    },
    [formatter, t]
  )

  const date = useCallback(
    (iso: string | null | undefined) => {
      if (!iso) return t('common.none')
      const value = new Date(iso)
      if (Number.isNaN(value.getTime())) return iso
      return dateFormatter.format(value)
    },
    [dateFormatter, t]
  )

  return { time, date }
}
