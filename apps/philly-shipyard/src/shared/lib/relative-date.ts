/**
 * 날짜 문자열 → D-day 표기 공용 유틸.
 *
 * `new Date('YYYY-MM-DD')`는 UTC 자정으로 파싱되어 음수 오프셋 타임존
 * (필라델피아 UTC-4/-5)에서 하루 밀린다 — 반드시 parseLocalDate를 거친다.
 * (calendar의 use-service-calendar.ts와 동일한 방식)
 */

/** 'YYYY-MM-DD'(또는 datetime의 날짜부) → 로컬 자정 Date */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 'YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm:ss'(TZ 없음) → 로컬 Date */
export function parseLocalDateTime(s: string): Date {
  const [datePart, timePart = '00:00:00'] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = timePart.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, ss || 0);
}

/** Date → 로컬 기준 'YYYY-MM-DD' (toISOString은 UTC 날짜라 저녁에 하루 밀림) */
export function toLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 로컬 자정 기준 오늘 */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 오늘(로컬 자정)부터 target까지 일수. 미래 양수, 과거 음수. */
export function daysFromToday(dateStr: string, today: Date = startOfToday()): number {
  return Math.round((parseLocalDate(dateStr).getTime() - today.getTime()) / 86_400_000);
}

/** from → target 일수 (올림). 미래 양수, 과거 음수. */
export function daysBetween(target: Date, from: Date): number {
  return Math.ceil((target.getTime() - from.getTime()) / 86_400_000);
}

export interface RelativeDate {
  /** 'D-3' | 'D-Day' | 'D+2' */
  label: string;
  /** 미래 양수, 과거 음수 */
  diff: number;
  /** 과거(기한 경과) 여부 */
  overdue: boolean;
}

export function formatRelativeDate(dateStr: string): RelativeDate {
  const diff = daysFromToday(dateStr);
  const label = diff === 0 ? 'D-Day' : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
  return { label, diff, overdue: diff < 0 };
}
