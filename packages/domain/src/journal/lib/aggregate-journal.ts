import type { AlarmSeverity } from '@crane/core/types/status';
import type { AlarmJournalEntry, CollisionJournalEntry } from '../model/types';

/**
 * journal 일별 집계 — 대시보드 추이 차트·KPI 용 순수 함수. `now` 를 항상
 * 주입받아 결정론을 유지한다(테스트·타임존 경계). 날짜 키는 로컬 기준
 * `YYYY-MM-DD` — UTC 로 자르면 자정 부근 항목이 옆 날로 샌다.
 */

export interface DailyCountPoint {
  /** 로컬 날짜 키 `YYYY-MM-DD`. */
  dateKey: string;
  count: number;
}

export interface DailyAlarmPoint {
  dateKey: string;
  critical: number;
  high: number;
  medium: number;
  info: number;
  total: number;
}

export function toLocalDateKey(time: number): string {
  const d = new Date(time);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** 오늘 포함 최근 `days` 일의 로컬 날짜 키, 오래된 날부터. */
function recentDateKeys(days: number, now: number): string[] {
  const keys: string[] = [];
  const base = new Date(now);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    keys.push(toLocalDateKey(d.getTime()));
  }
  return keys;
}

function bucketByDay<T>(
  entries: readonly T[],
  getTime: (entry: T) => number,
  days: number,
  now: number,
): Map<string, T[]> {
  const buckets = new Map<string, T[]>(
    recentDateKeys(days, now).map((key) => [key, []]),
  );
  for (const entry of entries) {
    const time = getTime(entry);
    if (!Number.isFinite(time)) continue;
    buckets.get(toLocalDateKey(time))?.push(entry);
  }
  return buckets;
}

/** 오늘 포함 최근 `days` 일 충돌 건수, 빈 날은 0. 오래된 날부터. */
export function bucketCollisionsByDay(
  entries: readonly CollisionJournalEntry[],
  days: number,
  now: number,
): DailyCountPoint[] {
  const buckets = bucketByDay(entries, (e) => e.at, days, now);
  return [...buckets].map(([dateKey, list]) => ({
    dateKey,
    count: list.length,
  }));
}

/** 오늘 포함 최근 `days` 일 알람 건수(심각도 분해), 빈 날은 0. 오래된 날부터. */
export function bucketAlarmsByDay(
  entries: readonly AlarmJournalEntry[],
  days: number,
  now: number,
): DailyAlarmPoint[] {
  const buckets = bucketByDay(entries, (e) => Date.parse(e.timestamp), days, now);
  return [...buckets].map(([dateKey, list]) => {
    const point: DailyAlarmPoint = {
      dateKey,
      critical: 0,
      high: 0,
      medium: 0,
      info: 0,
      total: list.length,
    };
    for (const entry of list) {
      point[entry.severity as AlarmSeverity] += 1;
    }
    return point;
  });
}

/** 로컬 기준 오늘 발생한 항목 수. */
export function countToday<T>(
  entries: readonly T[],
  getTime: (entry: T) => number,
  now: number,
): number {
  const todayKey = toLocalDateKey(now);
  let count = 0;
  for (const entry of entries) {
    const time = getTime(entry);
    if (Number.isFinite(time) && toLocalDateKey(time) === todayKey) count += 1;
  }
  return count;
}
