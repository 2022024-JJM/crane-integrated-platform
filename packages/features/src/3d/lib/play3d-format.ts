import type { EquipmentRuntimeStatus } from '@crane/core/types/status';
import type { SavedSceneInfo } from '@crane/domain/3d';
import {
  formatReplayTimestamp,
  getMonitoringTagMetadata,
} from '@crane/domain/monitoring';
import type { VirtualTagDefinition } from '@crane/domain/virtual-tag';
import { RUNTIME_STATUS_COLORS } from './model-runtime-status';
import {
  assignCollisionsToRows,
  assignZoneBandsToRows,
  collisionSummaries,
  lastEventAtMs,
  statusBands,
  zoneBands,
  type CollisionSummary,
  type EquipmentStat,
  type Play3dEvent,
  type Play3dEventKind,
  type Play3dStats,
  type StatusBand,
  type TagRangeBar,
  type ZoneBand,
} from './play3d-stats';
import { formatSimClock } from './sim-clock';

/**
 * 3D 플레이 표시 보조 — 마커 색·seek 선행량·위치/비율 환산·시간 축과 눈금·
 * 타임라인 확대와 재생 위치 따라가기 판단·표식과 hover 요약 조립·태그 행 라벨.
 * ui 파일의 수치 계산 금지 규칙(scene-shadow.ts 선례)에 따라 lib 에 둔다.
 */

/** 사건 종류별 마커 색(Tailwind 배경 클래스). 정지·이탈·복귀는 흐리게. */
export const PLAY3D_EVENT_COLORS: Record<Play3dEventKind, string> = {
  collision: 'bg-red-500',
  zoneEnter: 'bg-amber-400',
  zoneExit: 'bg-amber-400/40',
  holdStart: 'bg-violet-400',
  holdEnd: 'bg-violet-400/40',
  offlineEnter: 'bg-zinc-400',
  offlineExit: 'bg-zinc-400/40',
};

/**
 * 재생바 표식 띠에 세로 선으로 그리는 종류 — 영역은 선이 아니라 체류 구간
 * (대각선 박스)으로 그리고, 이탈·복귀·정지 해제는 사건 목록에만 둔다.
 */
export const PLAY3D_MARKER_KINDS: readonly Play3dEventKind[] = [
  'collision',
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

/** 표식으로 이동할 씬 시간 — 선행량만큼 앞, 0 밑으로는 가지 않는다. */
export function markerSeekTargetMs(
  atMs: number,
  source: 'replay' | 'simulation',
  frameDurationMs: number | undefined,
): number {
  if (!Number.isFinite(atMs)) return 0;
  return Math.max(0, atMs - markerSeekLeadMs(source, frameDurationMs));
}

/** 마커 위치(%) — 축 길이 밖은 100 으로 clamp. */
export function markerPercent(atMs: number, axisMs: number): number {
  if (!(axisMs > 0) || !Number.isFinite(atMs)) return 0;
  return Math.min(100, Math.max(0, (atMs / axisMs) * 100));
}

/** 밴드의 축 위 위치·폭(%) — 역방향은 폭 0, 축 밖은 clamp. */
export function bandPercent(
  fromMs: number,
  toMs: number,
  axisMs: number,
): { left: number; width: number } {
  const left = markerPercent(fromMs, axisMs);
  const right = markerPercent(toMs, axisMs);
  return { left, width: Math.max(0, right - left) };
}

/**
 * 시간 축 길이 — 리포트 타임라인과 재생바가 함께 쓴다. 길이(없으면 1초 바닥)·
 * 위치·마지막 사건·위치가 닿은 가장 먼 지점(seek·정지 중 포함) 중 최대다.
 * 반복 시나리오는 경과가 되감기지 않아(회차 = 경과 ÷ 길이) 길이에 고정하면
 * 첫 회차 뒤의 커서·표식이 전부 축 끝에 쌓인다. 닿은 지점을 넣는 이유는 실행
 * 중 축이 줄지 않게 하려는 것 — 위치만 따라가면 재생바 손잡이를 뒤로 끌 때
 * 축이 같이 줄어 값이 무너진다. 검사 구간(scanned) 끝이 아닌 이유는 정지 중
 * ⏩ 로 뛴 곳은 검사되지 않아 열린 구간에서 같은 붕괴가 나기 때문이다.
 * 비정상 값은 건너뛴다.
 */
export function timelineAxisMs(
  durationMs: number | null,
  positionMs: number,
  lastEventMs: number,
  reachedMs = 0,
): number {
  const base = durationMs !== null && durationMs > 0 ? durationMs : 1_000;
  let axis = Number.isFinite(base) ? base : 1_000;
  for (const v of [positionMs, lastEventMs, reachedMs]) {
    if (Number.isFinite(v) && v > axis) axis = v;
  }
  return axis;
}

/** 리포트 타임라인이 한 화면(트랙 폭)에 담는 시간. 축이 더 길면 가로로 늘린다. */
export const TIMELINE_FIT_MS = 3 * 60_000;
/** 확대 배율 상한 — 폭과 눈금 수가 끝없이 커지지 않게 한다. */
export const TIMELINE_MAX_SCALE = 144;
/** 타임라인 한 화면의 눈금 칸 수 상한. */
export const TIMELINE_VIEW_TICKS = 6;
/** 재생바(축 전체)의 눈금 칸 수 상한. */
export const TRANSPORT_TICKS = 10;
/** 눈금 개수의 안전 상한 — 간격이 지나치게 작아도 DOM 이 폭주하지 않는다. */
export const TICK_COUNT_MAX = 1_000;

/** 트랙 확대 배율 — FIT 이하는 1, 넘으면 축 ÷ FIT(상한 있음). 비정상 값은 1. */
export function timelineTrackScale(axisMs: number): number {
  if (!Number.isFinite(axisMs) || axisMs <= TIMELINE_FIT_MS) return 1;
  return Math.min(TIMELINE_MAX_SCALE, axisMs / TIMELINE_FIT_MS);
}

/**
 * 가로 스크롤되는 트랙 내용물의 CSS 폭. 배율 1 이하·비정상은 정확히 `100%`
 * (가로 스크롤바가 생기지 않는다). 장비 이름 열은 스크롤러 밖이라 빼지 않는다.
 */
export function timelineContentWidth(scale: number): string {
  if (!Number.isFinite(scale) || scale <= 1) return '100%';
  return `${scale * 100}%`;
}

/** 눈금 간격 후보(ms) — 1초 … 6시간. */
export const TIMELINE_TICK_STEPS_MS: readonly number[] = [
  1_000, 2_000, 5_000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000,
  600_000, 900_000, 1_800_000, 3_600_000, 7_200_000, 21_600_000,
];

/**
 * 둥근 눈금 간격 — `spanMs ÷ 간격 ≤ maxTicks` 인 가장 작은 후보. 후보를 다
 * 넘으면 마지막 후보의 배수. 비정상 span 은 첫 후보, 비정상 maxTicks 는 1.
 */
export function niceTickStepMs(spanMs: number, maxTicks: number): number {
  const steps = TIMELINE_TICK_STEPS_MS;
  const max =
    Number.isFinite(maxTicks) && maxTicks >= 1 ? Math.floor(maxTicks) : 1;
  if (!Number.isFinite(spanMs) || spanMs <= 0) return steps[0];
  for (const step of steps) {
    if (spanMs / step <= max) return step;
  }
  const last = steps[steps.length - 1];
  return Math.ceil(spanMs / max / last) * last;
}

/**
 * 눈금 시각(ms) — 0 부터 간격의 배수. 끝 반 칸 안의 배수는 라벨이 잘려서 빼고,
 * 축 끝과 정확히 같은 배수는 넣는다. 간격이 고정이라 축이 자라도 앞 눈금은
 * 움직이지 않는다. 비정상 입력은 [0], 개수는 TICK_COUNT_MAX 를 넘지 않는다.
 */
export function tickTimes(axisMs: number, stepMs: number): number[] {
  if (
    !Number.isFinite(axisMs) ||
    axisMs <= 0 ||
    !Number.isFinite(stepMs) ||
    stepMs <= 0
  ) {
    return [0];
  }
  const step = Math.max(stepMs, axisMs / TICK_COUNT_MAX);
  const out: number[] = [];
  for (let i = 0; i * step <= axisMs; i += 1) {
    const t = i * step;
    if (t === axisMs || t <= axisMs - step / 2) out.push(t);
  }
  return out;
}

/** 리포트 타임라인 눈금 — 한 화면 구간(축 ÷ 배율)에 맞춘 둥근 간격. */
export function timelineViewTicks(axisMs: number): number[] {
  if (!Number.isFinite(axisMs) || axisMs <= 0) return [0];
  const viewSpan = axisMs / timelineTrackScale(axisMs);
  return tickTimes(axisMs, niceTickStepMs(viewSpan, TIMELINE_VIEW_TICKS));
}

/** 재생바 눈금 — 축 전체에 맞춘 둥근 간격. */
export function transportTicks(axisMs: number): number[] {
  if (!Number.isFinite(axisMs) || axisMs <= 0) return [0];
  return tickTimes(axisMs, niceTickStepMs(axisMs, TRANSPORT_TICKS));
}

/** 스크롤 컨테이너의 치수와 커서 위치 — ui 가 DOM 에서 읽어 넘긴다. */
export interface TimelineScrollGeometry {
  /** 커서 위치(트랙 기준 0~100%). */
  cursorPercent: number;
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

/**
 * scrollLeft·scrollWidth 는 정수로 반올림된다 — 허용오차가 없으면 프로그램
 * 스크롤 직후의 scroll 이벤트가 "안 보임"으로 읽어 따라가기가 꺼진다.
 */
const TIMELINE_IN_VIEW_TOLERANCE_PX = 1;
/** 재생 중 페이지를 넘길 때 커서를 보이는 트랙의 이 비율 지점에 둔다. */
const TIMELINE_FOLLOW_LEAD_RATIO = 0.1;

function resolveTimelineGeometry(g: TimelineScrollGeometry) {
  const values = [g.cursorPercent, g.scrollLeft, g.clientWidth, g.scrollWidth];
  if (!values.every((v) => Number.isFinite(v))) return null;
  if (g.scrollWidth <= g.clientWidth || g.clientWidth <= 0) return null;
  const percent = Math.min(100, Math.max(0, g.cursorPercent));
  return {
    visibleTrack: g.clientWidth,
    cursorX: (percent * g.scrollWidth) / 100,
    left: g.scrollLeft,
    right: g.scrollLeft + g.clientWidth,
    maxScroll: g.scrollWidth - g.clientWidth,
  };
}

/** 커서가 스크롤러 안에 보이는지. 넘침이 없으면 항상 true. */
export function timelineCursorInView(g: TimelineScrollGeometry): boolean {
  const r = resolveTimelineGeometry(g);
  if (!r) return true;
  return (
    r.cursorX >= r.left - TIMELINE_IN_VIEW_TOLERANCE_PX &&
    r.cursorX <= r.right + TIMELINE_IN_VIEW_TOLERANCE_PX
  );
}

/**
 * 재생 위치 따라가기 — 새 scrollLeft(바꿀 필요 없으면 null)와 그 뒤 커서가
 * 보이는지. 재생 중에는 보이던 커서가 벗어났을 때만 넘긴다(오른쪽 이탈은 한
 * 페이지 넘김, 뒤로 점프는 가운데) — 사용자가 직접 스크롤해 둔 위치
 * (`wasInView` false)는 되돌리지 않는다. 일시정지 중에는 화면 밖이면 가운데로.
 */
export function timelineFollowScroll(
  input: TimelineScrollGeometry & { wasInView: boolean; isPlaying: boolean },
): { scrollLeft: number | null; inView: boolean } {
  const r = resolveTimelineGeometry(input);
  if (!r || timelineCursorInView(input)) {
    return { scrollLeft: null, inView: true };
  }
  if (input.isPlaying && !input.wasInView) {
    return { scrollLeft: null, inView: false };
  }
  const lead =
    input.isPlaying && r.cursorX > r.right
      ? r.visibleTrack * TIMELINE_FOLLOW_LEAD_RATIO
      : r.visibleTrack / 2;
  const target = r.cursorX - lead;
  return {
    scrollLeft: Math.round(Math.min(r.maxScroll, Math.max(0, target))),
    inView: true,
  };
}

/** 비율(0~1) → "83%". null 은 "—". */
export function formatRatio(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  return `${Math.round(ratio * 100)}%`;
}

/** 퍼센트(0~100) → "83%". null 은 "—". */
export function formatPercent(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) return '—';
  return `${Math.round(percent)}%`;
}

/** 소수 자리를 값 크기에 맞춰 줄인다(축 표). */
export function formatTagNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return value.toFixed(digits);
}

/**
 * 상태 밴드·적층 막대·범례의 색(hex) — 리포트 전용 팔레트. 가동만 전역
 * RUNTIME_STATUS_COLORS 와 같고, 대기·두절은 트랙 배경 위에서 면으로 읽히는
 * 회색 계열이다(대기가 더 밝다). unknown 은 그리지 않는다.
 */
export const PLAY3D_STATUS_FILL: Record<EquipmentRuntimeStatus, string | null> =
  {
    running: RUNTIME_STATUS_COLORS.running,
    idle: '#94a3b8',
    offline: '#52525b',
    unknown: null,
  };

/** 축 위 상대 위치(0~1) → 씬 시간. */
export function msAtFraction(fraction: number, axisMs: number): number {
  if (!(axisMs > 0) || !Number.isFinite(fraction)) return 0;
  return Math.min(axisMs, Math.max(0, fraction * axisMs));
}

/** 검사된 시간 ÷ 창 길이(0~1). 창이 0·NaN 이면 null, 1 상한. */
export function coverageRatio(
  scannedMs: number,
  windowEndMs: number,
): number | null {
  if (!(windowEndMs > 0) || !Number.isFinite(scannedMs)) return null;
  return Math.min(1, Math.max(0, scannedMs / windowEndMs));
}

/** value ÷ max 를 0~100 으로. max 가 0 이하이거나 값이 비정상이면 0. */
export function percentOf(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, (value * 100) / max));
}

export interface StatusShare {
  running: number;
  idle: number;
  offline: number;
  /** 적층 시작 위치(%) — 대기는 가동 뒤, 두절은 대기 뒤. */
  idleLeft: number;
  offlineLeft: number;
}

/** 장비 상태 적층 막대 — unknown 을 뺀 시간 대비 %. 분모 0 이면 null. */
export function statusSharePercents(
  eq: Pick<EquipmentStat, 'ms' | 'totalMs'>,
): StatusShare | null {
  const known = eq.totalMs - eq.ms.unknown;
  if (!(known > 0)) return null;
  const running = percentOf(eq.ms.running, known);
  const idle = percentOf(eq.ms.idle, known);
  return {
    running,
    idle,
    offline: percentOf(eq.ms.offline, known),
    idleLeft: running,
    offlineLeft: Math.min(100, running + idle),
  };
}

export interface RangeBarPercent {
  left: number;
  width: number;
  mean: number;
}

/** range bar 의 0~1 위치를 %(left·width·평균 점)로. */
export function rangeBarPercent(range: TagRangeBar): RangeBarPercent {
  const left = percentOf(range.min, 1);
  const right = percentOf(range.max, 1);
  return {
    left,
    width: Math.max(0, right - left),
    mean: percentOf(range.mean, 1),
  };
}

/** 사건 목록 필터 칩 — 키는 i18n `monitoring:play3d.filter.*`. */
export const PLAY3D_EVENT_FILTERS: readonly {
  key: string;
  kinds: readonly Play3dEventKind[];
}[] = [
  { key: 'all', kinds: [] },
  { key: 'collision', kinds: ['collision'] },
  { key: 'zone', kinds: ['zoneEnter', 'zoneExit'] },
  { key: 'hold', kinds: ['holdStart', 'holdEnd'] },
  { key: 'offline', kinds: ['offlineEnter', 'offlineExit'] },
];

export interface TagRowLabel {
  label: string;
  unit: string;
}

/**
 * 축 표의 행 라벨 — 원시 태그 키 대신 이름·단위. 시뮬레이션은 가상 태그 정의의
 * 이름·단위, 리플레이는 버스 키 `${craneId(하이픈→밑줄)}:${tagCode}` 를 나눠
 * 씬 모델의 장비 이름 + 태그 카탈로그 표시명·단위. 어느 쪽도 못 풀면 키 그대로.
 */
export function tagRowLabel(
  key: string,
  ctx: {
    source: 'replay' | 'simulation';
    defs: readonly VirtualTagDefinition[];
    scene: SavedSceneInfo | null;
  },
): TagRowLabel {
  if (ctx.source === 'simulation') {
    const def = ctx.defs.find((d) => d.key === key);
    if (!def) return { label: key, unit: '' };
    return { label: def.name || key, unit: def.unit ?? '' };
  }
  const sep = key.indexOf(':');
  if (sep <= 0 || sep >= key.length - 1) return { label: key, unit: '' };
  const craneKey = key.slice(0, sep);
  const tagCode = key.slice(sep + 1);
  const model = ctx.scene?.models.find(
    (m) =>
      typeof m.craneId === 'string' &&
      m.craneId.replace(/-/g, '_') === craneKey,
  );
  const meta = getMonitoringTagMetadata(tagCode);
  return {
    label: `${model?.equipName || craneKey} · ${meta.displayName}`,
    unit: meta.unit ?? '',
  };
}

// ---- 영역 체류 표식 · hover 요약(리포트 타임라인과 재생바 공용) ----

/**
 * 영역 체류 = 대각선 박스. 색 줄은 `currentColor`(등급 톤 클래스가 정한다), 그
 * 옆 어두운 1px 이 초록·밝은 트랙 위에서, 색 줄이 회색·어두운 트랙 위에서
 * 형태를 잡는다. 바탕은 투명이라 아래 상태 색이 비친다. 대각선은 영역 체류
 * 전용이다 — 다른 뜻(미검사 구간 등)으로 쓰지 않는다.
 */
export const PLAY3D_DWELL_HATCH =
  'repeating-linear-gradient(135deg, currentColor 0 2px, rgb(0 0 0 / 0.45) 2px 3px, transparent 3px 6px)';

/** 등급별 톤(Tailwind 글자색 → currentColor). */
export const PLAY3D_DWELL_TONE: Record<'warn' | 'stop', string> = {
  warn: 'text-amber-400',
  stop: 'text-red-500',
};

/** 박스 테두리 — 등급 색 1px + 어두운 링(밝은 배경에서 윤곽을 잡는다). */
export const PLAY3D_DWELL_BOX_CLASS =
  'border border-current ring-1 ring-black/30';

/** 표식에 마우스를 올렸을 때의 요약 내용 — 트리거가 payload 로 넘긴다. */
export type Play3dHoverPayload =
  | {
      kind: 'collision';
      event: Play3dEvent;
      timeLabel: string;
      summary: CollisionSummary | null;
    }
  | { kind: 'zone'; band: ZoneBand }
  | { kind: 'status'; band: StatusBand; name: string }
  | { kind: 'event'; event: Play3dEvent; timeLabel: string };

/** 사건 시각 표시 — 리플레이는 그 프레임의 실제 시각, 아니면 씬 시계(mm:ss). */
export function eventTimeLabel(
  event: Pick<Play3dEvent, 'atMs' | 'frameIndex'>,
  frames: readonly { timestamp: string }[],
): string {
  if (event.frameIndex !== null) {
    const stamp = frames[event.frameIndex]?.timestamp ?? null;
    const label = formatReplayTimestamp(stamp, 'time');
    if (label) return label;
  }
  return formatSimClock(event.atMs);
}

/** 구간 표시 — "04:00 ~ 05:10 (01:10)". 진행 중이면 끝 자리에 그 문구. */
export function formatBandSpan(
  fromMs: number,
  toMs: number,
  ongoingLabel: string | null = null,
): string {
  const duration = formatSimClock(Math.max(0, toMs - fromMs));
  const end = ongoingLabel ?? formatSimClock(toMs);
  return `${formatSimClock(fromMs)} ~ ${end} (${duration})`;
}

export interface TimelineStatusMark {
  key: string;
  band: StatusBand;
  payload: Play3dHoverPayload;
}

export interface TimelineZoneMark {
  key: string;
  band: ZoneBand;
  /** 현재 위치 뒤의 구간(재생바에서 흐리게). 타임라인은 항상 false. */
  dim: boolean;
  payload: Play3dHoverPayload;
}

export interface TimelineLineMark {
  key: string;
  event: Play3dEvent;
  dim: boolean;
  payload: Play3dHoverPayload;
}

export interface TimelineEquipmentRow {
  modelId: string;
  name: string;
  status: TimelineStatusMark[];
  zones: TimelineZoneMark[];
  collisions: TimelineLineMark[];
}

/**
 * 리포트 타임라인의 행 — 장비마다 상태 막대·배정된 영역 체류·관여한 충돌과 그
 * hover 요약. 사건 행은 따로 없다(사건은 장비 행에 겹쳐 그린다). 상태를 모르는
 * (unknown) 구간은 그리지 않는다.
 */
export function timelineRows(
  stats: Pick<
    Play3dStats,
    'equipment' | 'events' | 'statusTransitions' | 'scanned' | 'windowEndMs'
  >,
  timeLabel: (event: Play3dEvent) => string,
): TimelineEquipmentRow[] {
  const end = stats.windowEndMs;
  const rowIds = new Set(stats.equipment.map((eq) => eq.modelId));
  const strips = assignZoneBandsToRows(zoneBands(stats.events, end), rowIds);
  const hits = assignCollisionsToRows(stats.events, rowIds);
  const summaries = collisionSummaries(stats.events);
  return stats.equipment.map((eq) => ({
    modelId: eq.modelId,
    name: eq.name,
    status: statusBands(stats.statusTransitions, eq.modelId, end, stats.scanned)
      .filter((band) => PLAY3D_STATUS_FILL[band.status] !== null)
      .map((band) => ({
        key: `s${band.fromMs}`,
        band,
        payload: { kind: 'status', band, name: eq.name },
      })),
    zones: (strips.get(eq.modelId) ?? []).map((band) => ({
      key: `z${band.enterId}`,
      band,
      dim: false,
      payload: { kind: 'zone', band },
    })),
    collisions: (hits.get(eq.modelId) ?? []).map((event) => ({
      key: `c${event.id}`,
      event,
      dim: false,
      payload: {
        kind: 'collision',
        event,
        timeLabel: timeLabel(event),
        summary: summaries.get(event.id) ?? null,
      },
    })),
  }));
}

export interface TransportMarks {
  zones: TimelineZoneMark[];
  lines: TimelineLineMark[];
}

/**
 * 재생바 표식 — 영역은 체류 구간(박스), 나머지(PLAY3D_MARKER_KINDS)는 세로 선.
 * 원시 사건(기록 순, 뒤로 seek 하면 시각순이 아니다)을 받아 실행 전체를 그리고,
 * 현재 위치 뒤의 표식은 dim 으로 표시한다. 충돌 선을 마지막에 둬 위에 그려진다.
 */
export function transportMarks(
  events: readonly Play3dEvent[],
  windowEndMs: number,
  timeLabel: (event: Play3dEvent) => string,
): TransportMarks {
  const windowEnd =
    Number.isFinite(windowEndMs) && windowEndMs > 0 ? windowEndMs : 0;
  const end = Math.max(windowEnd, lastEventAtMs(events));
  const summaries = collisionSummaries(events);
  const lines: TimelineLineMark[] = events
    .filter(
      (e) => PLAY3D_MARKER_KINDS.includes(e.kind) && Number.isFinite(e.atMs),
    )
    .map((event) => ({
      key: `e${event.id}`,
      event,
      dim: event.atMs > windowEnd,
      payload:
        event.kind === 'collision'
          ? {
              kind: 'collision' as const,
              event,
              timeLabel: timeLabel(event),
              summary: summaries.get(event.id) ?? null,
            }
          : { kind: 'event' as const, event, timeLabel: timeLabel(event) },
    }));
  return {
    zones: zoneBands(events, end).map((band) => ({
      key: `z${band.enterId}`,
      band,
      dim: band.fromMs > windowEnd,
      payload: { kind: 'zone', band },
    })),
    lines: [
      ...lines.filter((m) => m.event.kind !== 'collision'),
      ...lines.filter((m) => m.event.kind === 'collision'),
    ],
  };
}
