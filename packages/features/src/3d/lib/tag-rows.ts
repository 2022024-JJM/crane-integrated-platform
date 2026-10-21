import { getMonitoringTagMetadata } from '@crane/domain/monitoring';
import type { CraneSnapshotEntry, CraneTagStat } from './crane-snapshot-stats';

export type TagCategory = 'datetime' | 'measurement' | 'status';

export const TAG_CATEGORIES: readonly TagCategory[] = [
  'datetime',
  'measurement',
  'status',
];

export interface TagRow {
  code: string;
  /** `getMonitoringTagMetadata` 의 영문 표시명(예: "MH#1 Weight"). */
  name: string;
  category: TagCategory;
  unit: string | null;
  /** 켜지면 알람인 비트(crane_system_error 등). */
  alarm: boolean;
  value: number | boolean;
  timestamp: string | null;
  stat: CraneTagStat;
}

/** 시각 태그는 알파벳이 아니라 큰 단위 → 작은 단위 순. */
const DATETIME_ORDER = ['year', 'month', 'day', 'hour', 'minute', 'second'];

const EMPTY_STAT: CraneTagStat = {
  changedAt: null,
  changeCount: 0,
  min: null,
  max: null,
};

function toCategory(value: string): TagCategory {
  return value === 'datetime' || value === 'measurement' ? value : 'status';
}

export function compareTagRows(a: TagRow, b: TagRow): number {
  const categoryDiff =
    TAG_CATEGORIES.indexOf(a.category) - TAG_CATEGORIES.indexOf(b.category);
  if (categoryDiff !== 0) return categoryDiff;
  if (a.category === 'datetime') {
    const diff =
      DATETIME_ORDER.indexOf(a.code) - DATETIME_ORDER.indexOf(b.code);
    if (diff !== 0) return diff;
  }
  return a.code.localeCompare(b.code, 'en', { numeric: true });
}

/**
 * 스냅샷 한 대분을 표 행으로 — 묶음(시각·계측값·상태) 순, 묶음 안은 코드의
 * 숫자 인식 사전순(ts1 < ts2 < ts10). 이름·단위·묶음은 플랫폼의 태그
 * 카탈로그(영문)에서 온다.
 */
export function buildTagRows(
  entry: Pick<CraneSnapshotEntry, 'snapshot' | 'stats'>,
): TagRow[] {
  const rows: TagRow[] = [];
  for (const [code, tag] of Object.entries(entry.snapshot.tags)) {
    const meta = getMonitoringTagMetadata(code);
    rows.push({
      code,
      name: meta.displayName,
      category: toCategory(meta.category),
      unit: meta.unit,
      alarm: meta.alarm,
      value: tag.value,
      timestamp: tag.timestamp,
      stat: entry.stats[code] ?? EMPTY_STAT,
    });
  }
  return rows.sort(compareTagRows);
}

/** 묶음 선택 + 코드·이름 부분 일치(대소문자 무시, 앞뒤 공백 무시). */
export function filterTagRows(
  rows: readonly TagRow[],
  category: TagCategory | 'all',
  query: string,
): TagRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (category === 'all' || row.category === category) &&
      (!needle ||
        row.code.toLowerCase().includes(needle) ||
        row.name.toLowerCase().includes(needle)),
  );
}

/** 묶음별 행 수(필터 뒤) — 묶음 머리글에 쓴다. */
export function countTagRowsByCategory(
  rows: readonly TagRow[],
): Record<TagCategory, number> {
  const counts: Record<TagCategory, number> = {
    datetime: 0,
    measurement: 0,
    status: 0,
  };
  for (const row of rows) counts[row.category] += 1;
  return counts;
}

export type BoolTone = 'good' | 'bad' | 'neutral' | 'none';

export interface BoolDisplay {
  /** i18n `monitoring:tags.bool.*` 키. */
  key: 'on' | 'off' | 'ok' | 'ng' | 'one' | 'zero';
  tone: BoolTone;
}

const STATUS_BIT = /_status$/;

/**
 * 불리언 태그의 글자와 색조.
 * - `*_status`: true 가 정상 → OK(초록) / NG(빨강)
 * - heartbeat: 1 / 0 (의미 없는 토글이라 색 없음)
 * - 알람 비트: 켜지면 빨강 ON, 꺼지면 흐린 OFF
 * - 그 밖의 비트(제어 전원·바이패스 등): 켜지면 중립 ON
 */
export function resolveBoolDisplay(
  row: Pick<TagRow, 'code' | 'alarm'>,
  value: boolean,
): BoolDisplay {
  if (STATUS_BIT.test(row.code)) {
    return value ? { key: 'ok', tone: 'good' } : { key: 'ng', tone: 'bad' };
  }
  if (row.code === 'heartbeat') {
    return value
      ? { key: 'one', tone: 'neutral' }
      : { key: 'zero', tone: 'none' };
  }
  if (!value) return { key: 'off', tone: 'none' };
  return { key: 'on', tone: row.alarm ? 'bad' : 'neutral' };
}
