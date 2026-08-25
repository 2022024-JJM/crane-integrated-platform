import { useCallback, useMemo } from 'react'
import { useTranslation } from './useTranslation'
import { useLanguage } from './useLanguage'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export interface TimeFormat {
  /** "3분 전" / "3 min ago" — 얼마나 오래된 것인가가 요점인 자리 */
  relative: (iso: string, now?: Date) => string
  /** 정확한 시각 — 상대 표기만으로는 대조가 안 되므로 툴팁에 함께 싣는다 */
  absolute: (iso: string) => string
  /** 날짜만 (월·일·요일) */
  date: (date: Date) => string
}

/**
 * 언어를 따라가는 시각 서식.
 *
 * `toLocaleString('ko-KR')` 을 화면마다 하드코딩하면 언어를 바꿔도 시계와 날짜만
 * 한국어로 남는다 — 서식 로케일은 항상 현재 언어에서 끌어온다.
 */
export function useTimeFormat(): TimeFormat {
  const { t } = useTranslation()
  const { locale } = useLanguage()

  const absoluteFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [locale]
  )

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', weekday: 'short' }),
    [locale]
  )

  const shortDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }),
    [locale]
  )

  const relative = useCallback(
    (iso: string, now: Date = new Date()) => {
      const target = new Date(iso)
      const diff = now.getTime() - target.getTime()

      if (Number.isNaN(diff)) return t('common.none')
      if (diff < MINUTE) return t('common.justNow')
      if (diff < HOUR) return t('common.minutesAgo', { count: Math.floor(diff / MINUTE) })
      if (diff < DAY) return t('common.hoursAgo', { count: Math.floor(diff / HOUR) })
      if (diff < 7 * DAY) return t('common.daysAgo', { count: Math.floor(diff / DAY) })

      // 일주일이 넘으면 상대 표기가 감을 주지 못한다 — 날짜로 바꾼다
      return shortDateFormatter.format(target)
    },
    [t, shortDateFormatter]
  )

  const absolute = useCallback(
    (iso: string) => {
      const target = new Date(iso)
      if (Number.isNaN(target.getTime())) return t('common.none')
      return absoluteFormatter.format(target)
    },
    [t, absoluteFormatter]
  )

  const date = useCallback((value: Date) => dateFormatter.format(value), [dateFormatter])

  return { relative, absolute, date }
}
