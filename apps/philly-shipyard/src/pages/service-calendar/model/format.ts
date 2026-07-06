import { getFormatLocale } from '@crane/core/config/i18n';

/** i18n 언어 → Intl 로케일 코드 (la 등 폴백 포함) */
export function localeOf(language: string): string {
  return getFormatLocale(language);
}

export function formatTime(d: Date, language: string): string {
  return new Intl.DateTimeFormat(localeOf(language), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatMonthTitle(d: Date, language: string): string {
  return new Intl.DateTimeFormat(localeOf(language), {
    year: 'numeric',
    month: 'long',
  }).format(d);
}

export function formatDayTitle(d: Date, language: string): string {
  return new Intl.DateTimeFormat(localeOf(language), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(d);
}

export function formatWeekdayShort(d: Date, language: string): string {
  return new Intl.DateTimeFormat(localeOf(language), { weekday: 'short' }).format(d);
}

export function formatDateRange(a: Date, b: Date, language: string): string {
  const fmt = new Intl.DateTimeFormat(localeOf(language), {
    month: 'short',
    day: 'numeric',
  });
  return `${fmt.format(a)} – ${fmt.format(b)}`;
}
