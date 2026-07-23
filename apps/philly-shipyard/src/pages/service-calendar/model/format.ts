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

/** 구글 캘린더식 짧은 시각 — 정시는 '오전 8시', 그 외 '오전 10:30' */
export function formatTimeShort(d: Date, language: string): string {
  const opts: Intl.DateTimeFormatOptions =
    d.getMinutes() === 0 ? { hour: 'numeric' } : { hour: 'numeric', minute: '2-digit' };
  return new Intl.DateTimeFormat(localeOf(language), opts).format(d);
}

/** 월 경계 셀 라벨 — '7월 1일' / 'Jul 1' */
export function formatMonthDay(d: Date, language: string): string {
  return new Intl.DateTimeFormat(localeOf(language), {
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/** 타임그리드 시간 눈금 라벨 — 구글 캘린더식 '오전 1시' / '1 AM' */
export function formatHourLabel(hour: number, language: string): string {
  return new Intl.DateTimeFormat(localeOf(language), { hour: 'numeric' }).format(
    new Date(2000, 0, 1, hour),
  );
}

/** 현재 타임존의 GMT 오프셋 라벨 — 'GMT+09' 형식 (타임그리드 코너 셀용) */
export function gmtOffsetLabel(d: Date = new Date()): string {
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0');
  const mins = Math.abs(offsetMin) % 60;
  return `GMT${sign}${hours}${mins > 0 ? `:${String(mins).padStart(2, '0')}` : ''}`;
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
