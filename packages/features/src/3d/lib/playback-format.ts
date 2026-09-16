import type { PlaybackEventKind } from './playback-stats';

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
