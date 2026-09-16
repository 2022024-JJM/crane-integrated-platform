import type { EquipmentRuntimeStatus } from '@crane/core/types/status';
import { RUNTIME_STATUS_COLORS } from './model-runtime-status';
import type {
  CollisionPairStat,
  PlaybackEventKind,
  ZoneIntruderRank,
} from './playback-stats';

/**
 * 플레이백 표시 보조 — 마커 색·seek 선행량. ui 파일의 수치 계산 금지 규칙
 * (scene-shadow.ts 선례)에 따라 lib 에 둔다.
 */

/** 사건 종류별 마커 색(Tailwind 배경 클래스). 정지·이탈·복귀는 흐리게. */
export const PLAYBACK_EVENT_COLORS: Record<PlaybackEventKind, string> = {
  collision: 'bg-red-500',
  zoneEnter: 'bg-amber-400',
  zoneExit: 'bg-amber-400/40',
  holdStart: 'bg-violet-400',
  holdEnd: 'bg-violet-400/40',
  offlineEnter: 'bg-zinc-400',
  offlineExit: 'bg-zinc-400/40',
};

/** 타임라인에 그리는 종류 — 이탈·복귀·정지 해제는 표에만 두고 띠는 비운다. */
export const PLAYBACK_MARKER_KINDS: readonly PlaybackEventKind[] = [
  'collision',
  'zoneEnter',
  'holdStart',
  'offlineEnter',
];

/**
 * 마커 seek 선행량(ms) — 감지는 스무딩된 자세를 보므로 원인 프레임보다 늦다.
 * 리플레이는 한 프레임(그 프레임 길이), 시뮬레이션은 스무딩 시간 남짓.
 */
export function markerSeekLeadMs(
  source: 'replay' | 'simulation',
  frameDurationMs: number | undefined,
): number {
  if (source === 'replay') return Math.max(0, frameDurationMs ?? 5_000);
  return 500;
}

/** 마커 위치(%) — 축 길이 밖은 100 으로 clamp. */
export function markerPercent(atMs: number, axisMs: number): number {
  if (!(axisMs > 0) || !Number.isFinite(atMs)) return 0;
  return Math.min(100, Math.max(0, (atMs / axisMs) * 100));
}

/** 타임라인 축 길이 — 시나리오·리플레이 길이, 없으면 지금까지 본 최대 시각. */
export function timelineAxisMs(
  durationMs: number | null,
  positionMs: number,
  lastEventMs: number,
): number {
  if (durationMs !== null && durationMs > 0) return durationMs;
  return Math.max(1_000, positionMs, lastEventMs);
}

/** 비율(0~1) → "83%". null 은 "—". */
export function formatRatio(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  return `${Math.round(ratio * 100)}%`;
}

/** 소수 자리를 값 크기에 맞춰 줄인다(태그 표). */
export function formatTagNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return value.toFixed(digits);
}

/** 상태 밴드 색(hex) — 미니맵·HUD 와 같은 팔레트. unknown 은 그리지 않는다. */
export const PLAYBACK_STATUS_FILL: Record<
  EquipmentRuntimeStatus,
  string | null
> = RUNTIME_STATUS_COLORS;

/** 균등 축 눈금(ms) — 0 과 axis 를 포함해 n+1 개. */
export function timelineTicks(axisMs: number, n = 4): number[] {
  if (!(axisMs > 0) || !(n > 0)) return [0];
  const out: number[] = [];
  for (let i = 0; i <= n; i += 1) out.push((axisMs * i) / n);
  return out;
}

/** 축 위 상대 위치(0~1) → 씬 시간. */
export function msAtFraction(fraction: number, axisMs: number): number {
  if (!(axisMs > 0) || !Number.isFinite(fraction)) return 0;
  return Math.min(axisMs, Math.max(0, fraction * axisMs));
}

/** 스파크라인 스텝 경로 — viewBox 0..100 × 0..height. 점이 없으면 ''. */
export function sparklinePath(
  points: readonly { t: number; v: number }[],
  axisMs: number,
  maxV: number,
  height: number,
): string {
  if (points.length === 0 || !(axisMs > 0)) return '';
  const top = maxV > 0 ? maxV : 1;
  const x = (t: number) => Math.min(100, Math.max(0, (t / axisMs) * 100));
  const y = (v: number) => height - Math.min(1, Math.max(0, v / top)) * height;
  let d = `M${x(points[0].t).toFixed(2)},${y(points[0].v).toFixed(2)}`;
  for (let i = 1; i < points.length; i += 1) {
    // 스텝: 이전 값을 다음 시각까지 끌고 간 뒤 올린다.
    d += ` H${x(points[i].t).toFixed(2)} V${y(points[i].v).toFixed(2)}`;
  }
  return d;
}

/** 사건 목록 필터 칩 — 키는 i18n `monitoring:playback.filter.*`. */
export const PLAYBACK_EVENT_FILTERS: readonly {
  key: string;
  kinds: readonly PlaybackEventKind[];
}[] = [
  { key: 'all', kinds: [] },
  { key: 'collision', kinds: ['collision'] },
  { key: 'zone', kinds: ['zoneEnter', 'zoneExit'] },
  { key: 'hold', kinds: ['holdStart', 'holdEnd'] },
  { key: 'offline', kinds: ['offlineEnter', 'offlineExit'] },
];

export interface RankingRow {
  key: string;
  label: string;
  count: number;
  tone: 'bad' | 'warn';
}

export function pairRankingRows(
  pairs: readonly CollisionPairStat[],
): RankingRow[] {
  return pairs.map((p) => ({
    key: p.pairKey,
    label: p.label,
    count: p.count,
    tone: 'bad',
  }));
}

export function zoneRankingRows(
  rows: readonly ZoneIntruderRank[],
): RankingRow[] {
  return rows.map((r) => ({
    key: `${r.zoneKey}|${r.intruderId}`,
    label: `${r.zoneName} ← ${r.intruderName}`,
    count: r.count,
    tone: r.level === 'stop' ? 'bad' : 'warn',
  }));
}
