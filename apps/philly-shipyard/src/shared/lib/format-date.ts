import { getFormatLocale } from '@crane/core/config/i18n';
import { parseLocalDate } from './relative-date';

/**
 * 'YYYY-MM-DD' 절대 일자 → 로케일 표기 ('Aug 15, 2026' / '2026년 8월 15일').
 *
 * 캘린더(service-calendar/model/format.ts)와 동일한 Intl 방식이되, 만료일·입고일 등
 * 연 단위로 벌어지는 레코드 일자라 year를 포함한다.
 * parseLocalDate로 UTC 자정 밀림(필라델피아 음수 오프셋)을 피한다.
 */
export function formatDateLabel(dateStr: string, language: string): string {
  return new Intl.DateTimeFormat(getFormatLocale(language), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parseLocalDate(dateStr));
}
