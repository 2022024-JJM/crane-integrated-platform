import type { EquipmentRuntimeStatus } from '@crane/core/types/status';

/**
 * 3D 플레이 실행 통계 — 순수 집계. 기록기(use-play3d-stats-recorder)가 재생
 * 중 쌓은 사건·상태·태그 누적을 받아 "시작점 ~ 현재 재생 위치" 창의 리포트를
 * 만든다.
 *
 * 시간 축은 씬 시간(ms)이다 — 리플레이는 프레임 누적 ms, 시뮬레이션은 러너
 * 경과 ms(배속 무관). 사건은 `atMs` 로 창에 걸러지고(뒤로 seek 하면 현재
 * 위치 이후 사건은 감춰질 뿐 지워지지 않는다), 상태·태그 누적은 단조 누적이라
 * 창과 무관하게 "검사한 시간 전체" 다. 정지(hold) 시간만은 벽시계다 — 정지
 * 중엔 씬 시간이 흐르지 않아 씬 시간으로 재면 항상 0 이다.
 */

export type Play3dEventKind =
  | 'collision'
  | 'zoneEnter'
  | 'zoneExit'
  | 'holdStart'
  | 'holdEnd'
  | 'offlineEnter'
  | 'offlineExit';

export interface Play3dEvent {
  /** 세션 내 증가 카운터 — 목록 key. */
  id: number;
  kind: Play3dEventKind;
  /** 씬 시간(ms). */
  atMs: number;
  /** 리플레이면 그 프레임 index, 시뮬레이션은 null. */
  frameIndex: number | null;
  /**
   * 사건 주체 — 충돌은 pairKey, 영역은 `${zoneKey}|${intruderId}`, 두절은
   * modelId, 정지는 'collision' | 'zone'. 진입·이탈 짝짓기의 키다.
   */
  subject: string;
  /** 표시 문구(장비 이름 등) — 호출자가 만든다. */
  label: string;
  /** 영역 사건의 등급. */
  level?: 'warn' | 'stop';
  /** 영역 사건의 zoneKey(집계 키). */
  zoneKey?: string;
  zoneName?: string;
  intruderId?: string;
  intruderName?: string;
}

export interface TagAggregate {
  key: string;
  min: number;
  max: number;
  sum: number;
  count: number;
  /** |Δ| 합 — 이동량. */
  travel: number;
  last: number | null;
  lastAtMs: number | null;
  /** 속도 한계에 잘려 목표를 못 따라간 씬 시간(ms) — 시뮬레이션만. */
  saturatedMs: number;
  /** 한계 정의가 있는지(saturatedMs 의 분모가 의미 있는지). */
  hasSpeedLimit: boolean;
}

export type StatusMs = Record<EquipmentRuntimeStatus, number>;

export interface StatusAggregate {
  modelId: string;
  name: string;
  ms: StatusMs;
}

export interface ScannedInterval {
  fromMs: number;
  toMs: number;
}

export interface Play3dStatsInput {
  events: readonly Play3dEvent[];
  /** 장비 상태 전이(밴드 타임라인·가동 비율 곡선용). 없으면 빈 배열. */
  statusTransitions?: readonly StatusTransition[];
  statuses: Readonly<Record<string, StatusAggregate>>;
  tags: Readonly<Record<string, TagAggregate>>;
  scanned: readonly ScannedInterval[];
  /** 현재 재생 위치(씬 ms) — 창의 끝. */
  windowEndMs: number;
  /** 활성 시나리오 길이(ms). 없으면 null(열린 구간). */
  scenarioDurationMs: number | null;
  /** 정지(hold) 누적 — 벽시계 ms. */
  holdWallMs: number;
  /** 재생 중 충돌 감지가 꺼져 있던 순간이 있었는지. */
  detectionOffSeen: boolean;
}

export interface CollisionPairStat {
  pairKey: string;
  label: string;
  count: number;
  firstAtMs: number;
}

export interface ZoneStat {
  zoneKey: string;
  zoneName: string;
  level: 'warn' | 'stop';
  enters: number;
  stopEnters: number;
  dwellMs: number;
  maxDwellMs: number;
  /** 아직 이탈하지 않은 침범자 수(창 끝 기준). */
  open: number;
  byIntruder: { intruderId: string; intruderName: string; count: number }[];
}

export interface EquipmentStat extends StatusAggregate {
  totalMs: number;
  /** 두절 진입 횟수. */
  offlineEpisodes: number;
}

export interface TagStat extends TagAggregate {
  mean: number | null;
  /** saturatedMs ÷ 검사된 시간. 한계 정의가 없으면 null. */
  saturationRatio: number | null;
}

export interface Play3dStats {
  windowEndMs: number;
  /** 입력 그대로 통과 — 시각화가 lib 함수(statusBands 등)로 파생한다. */
  statusTransitions: readonly StatusTransition[];
  scanned: readonly ScannedInterval[];
  scannedMs: number;
  /** 시나리오 회차(0부터). 열린 구간이면 null. */
  loopIteration: number | null;
  detectionOffSeen: boolean;
  /** 창 안 사건(시각 오름차순). */
  events: Play3dEvent[];
  collisions: {
    count: number;
    firstAtMs: number | null;
    byPair: CollisionPairStat[];
  };
  zones: {
    enters: number;
    stopEnters: number;
    byZone: ZoneStat[];
  };
  holds: { count: number; wallMs: number };
  equipment: EquipmentStat[];
  tags: TagStat[];
}

export const STATUS_KEYS: readonly EquipmentRuntimeStatus[] = [
  'running',
  'idle',
  'offline',
  'unknown',
];

export function emptyStatusMs(): StatusMs {
  return { running: 0, idle: 0, offline: 0, unknown: 0 };
}

/** 구간 목록에 하나를 더해 겹침·인접을 합친다(정렬 유지, 새 배열). */
export function addScannedInterval(
  intervals: readonly ScannedInterval[],
  fromMs: number,
  toMs: number,
): ScannedInterval[] {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return [...intervals];
  }
  const out: ScannedInterval[] = [];
  let cur = { fromMs, toMs };
  let placed = false;
  for (const it of intervals) {
    if (it.toMs < cur.fromMs) {
      out.push(it);
    } else if (it.fromMs > cur.toMs) {
      if (!placed) {
        out.push(cur);
        placed = true;
      }
      out.push(it);
    } else {
      cur = {
        fromMs: Math.min(it.fromMs, cur.fromMs),
        toMs: Math.max(it.toMs, cur.toMs),
      };
    }
  }
  if (!placed) out.push(cur);
  return out;
}

export function sumScanned(intervals: readonly ScannedInterval[]): number {
  let sum = 0;
  for (const it of intervals) sum += Math.max(0, it.toMs - it.fromMs);
  return sum;
}

/** 시나리오 회차 — 경과 ÷ 길이. 길이가 0·없음이면 null. */
export function loopIterationOf(
  elapsedMs: number,
  durationMs: number | null,
): number | null {
  if (durationMs === null || !(durationMs > 0)) return null;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.floor(elapsedMs / durationMs);
}

/** 태그 집계에 값 하나를 더한다(제자리 갱신). NaN·무한은 무시. */
export function accumulateTagValue(
  agg: TagAggregate,
  value: number,
  atMs: number,
  maxSpeed: number | null,
): void {
  if (!Number.isFinite(value)) return;
  if (agg.count === 0) {
    agg.min = value;
    agg.max = value;
  } else {
    if (value < agg.min) agg.min = value;
    if (value > agg.max) agg.max = value;
  }
  agg.sum += value;
  agg.count += 1;
  if (agg.last !== null && agg.lastAtMs !== null) {
    const delta = Math.abs(value - agg.last);
    agg.travel += delta;
    const dtMs = atMs - agg.lastAtMs;
    if (maxSpeed !== null && maxSpeed > 0 && dtMs > 0) {
      const speed = delta / (dtMs / 1000);
      if (speed >= maxSpeed * SATURATION_RATIO) agg.saturatedMs += dtMs;
    }
  }
  agg.last = value;
  agg.lastAtMs = Number.isFinite(atMs) ? atMs : agg.lastAtMs;
}

/** 한계 대비 이 비율 이상의 속도면 "한계에 잘린" 것으로 본다. */
export const SATURATION_RATIO = 0.98;

export function createTagAggregate(
  key: string,
  hasSpeedLimit: boolean,
): TagAggregate {
  return {
    key,
    min: Number.NaN,
    max: Number.NaN,
    sum: 0,
    count: 0,
    travel: 0,
    last: null,
    lastAtMs: null,
    saturatedMs: 0,
    hasSpeedLimit,
  };
}

export function computePlay3dStats(input: Play3dStatsInput): Play3dStats {
  const windowEndMs = Number.isFinite(input.windowEndMs)
    ? Math.max(0, input.windowEndMs)
    : 0;
  const events = input.events
    .filter((e) => Number.isFinite(e.atMs) && e.atMs <= windowEndMs)
    .sort((a, b) => a.atMs - b.atMs || a.id - b.id);

  // 충돌
  const pairs = new Map<string, CollisionPairStat>();
  let firstCollision: number | null = null;
  for (const e of events) {
    if (e.kind !== 'collision') continue;
    if (firstCollision === null) firstCollision = e.atMs;
    const stat = pairs.get(e.subject);
    if (stat) stat.count += 1;
    else {
      pairs.set(e.subject, {
        pairKey: e.subject,
        label: e.label,
        count: 1,
        firstAtMs: e.atMs,
      });
    }
  }

  // 영역 — 진입·이탈 짝짓기. 이탈 없는 진입은 창 끝까지 체류.
  const zones = new Map<string, ZoneStat>();
  const open = new Map<string, { zoneKey: string; atMs: number }>();
  const zoneOf = (e: Play3dEvent): ZoneStat => {
    const key = e.zoneKey ?? e.subject;
    let z = zones.get(key);
    if (!z) {
      z = {
        zoneKey: key,
        zoneName: e.zoneName ?? key,
        level: e.level ?? 'warn',
        enters: 0,
        stopEnters: 0,
        dwellMs: 0,
        maxDwellMs: 0,
        open: 0,
        byIntruder: [],
      };
      zones.set(key, z);
    }
    return z;
  };
  const addDwell = (z: ZoneStat, ms: number) => {
    z.dwellMs += ms;
    if (ms > z.maxDwellMs) z.maxDwellMs = ms;
  };
  let enters = 0;
  let stopEnters = 0;
  for (const e of events) {
    if (e.kind === 'zoneEnter') {
      const z = zoneOf(e);
      // 같은 쌍의 중복 진입(뒤로 seek 뒤 재통과)은 앞선 진입을 닫는다.
      const prev = open.get(e.subject);
      if (prev) addDwell(z, Math.max(0, e.atMs - prev.atMs));
      open.set(e.subject, { zoneKey: z.zoneKey, atMs: e.atMs });
      z.enters += 1;
      enters += 1;
      if (e.level === 'stop') {
        z.stopEnters += 1;
        stopEnters += 1;
      }
      const id = e.intruderId ?? e.subject;
      const row = z.byIntruder.find((r) => r.intruderId === id);
      if (row) row.count += 1;
      else {
        z.byIntruder.push({
          intruderId: id,
          intruderName: e.intruderName ?? id,
          count: 1,
        });
      }
    } else if (e.kind === 'zoneExit') {
      const prev = open.get(e.subject);
      if (!prev) continue; // 진입을 못 본 이탈(창 밖 진입)은 세지 않는다.
      open.delete(e.subject);
      addDwell(zoneOf(e), Math.max(0, e.atMs - prev.atMs));
    }
  }
  for (const [, o] of open) {
    const z = zones.get(o.zoneKey);
    if (!z) continue;
    z.open += 1;
    addDwell(z, Math.max(0, windowEndMs - o.atMs));
  }

  // 정지
  const holdCount = events.filter((e) => e.kind === 'holdStart').length;

  // 장비
  const offlineEpisodes = new Map<string, number>();
  for (const e of events) {
    if (e.kind !== 'offlineEnter') continue;
    offlineEpisodes.set(e.subject, (offlineEpisodes.get(e.subject) ?? 0) + 1);
  }
  const equipment: EquipmentStat[] = Object.values(input.statuses)
    .map((s) => ({
      ...s,
      totalMs: STATUS_KEYS.reduce((acc, k) => acc + (s.ms[k] ?? 0), 0),
      offlineEpisodes: offlineEpisodes.get(s.modelId) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // 태그
  const scannedMs = sumScanned(input.scanned);
  const tags: TagStat[] = Object.values(input.tags)
    .map((t) => ({
      ...t,
      mean: t.count > 0 ? t.sum / t.count : null,
      saturationRatio:
        t.hasSpeedLimit && scannedMs > 0
          ? Math.min(1, t.saturatedMs / scannedMs)
          : null,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    windowEndMs,
    statusTransitions: input.statusTransitions ?? [],
    scanned: input.scanned,
    scannedMs,
    loopIteration: loopIterationOf(windowEndMs, input.scenarioDurationMs),
    detectionOffSeen: input.detectionOffSeen,
    events,
    collisions: {
      count: events.filter((e) => e.kind === 'collision').length,
      firstAtMs: firstCollision,
      byPair: [...pairs.values()].sort((a, b) => b.count - a.count),
    },
    zones: {
      enters,
      stopEnters,
      byZone: [...zones.values()].sort((a, b) => b.enters - a.enters),
    },
    holds: { count: holdCount, wallMs: Math.max(0, input.holdWallMs) },
    equipment,
    tags,
  };
}

// ---- 시간 축 파생(리포트 시각화용) ----

/** 장비 운전 상태 전이 — 밴드 타임라인의 유일한 출처. */
export interface StatusTransition {
  atMs: number;
  modelId: string;
  from: EquipmentRuntimeStatus;
  to: EquipmentRuntimeStatus;
}

export interface SeriesPoint {
  t: number;
  v: number;
}

export interface TimeBand {
  fromMs: number;
  toMs: number;
}

export interface StatusBand extends TimeBand {
  status: EquipmentRuntimeStatus;
}

export interface ZoneBand extends TimeBand {
  zoneKey: string;
  zoneName: string;
  level: 'warn' | 'stop';
  intruderId: string;
  intruderName: string;
  /** 창 끝에서 아직 이탈하지 않았는지. */
  open: boolean;
}

export interface HoldBand extends TimeBand {
  subject: string;
}

/** 균등 눈금(0 ~ axisMs, n 등분 경계 n+1 개). axis 가 0 이하면 [0]. */
export function seriesGrid(axisMs: number, buckets: number): number[] {
  if (!(axisMs > 0) || !(buckets > 0)) return [0];
  const out: number[] = [];
  for (let i = 0; i <= buckets; i += 1) out.push((axisMs * i) / buckets);
  return out;
}

/**
 * 사건 누적 스텝 시리즈 — 격자 시각마다 "그 시각까지의 사건 수". 창 끝
 * (`windowEndMs`) 이후 격자는 제외하고 마지막 점을 창 끝에 찍어 곡선이
 * 현재 위치에서 멈춘다.
 */
export function cumulativeSeries(
  events: readonly Play3dEvent[],
  kinds: readonly Play3dEventKind[],
  axisMs: number,
  windowEndMs: number,
  buckets = 60,
): SeriesPoint[] {
  const end = Number.isFinite(windowEndMs) ? Math.max(0, windowEndMs) : 0;
  const times = events
    .filter((e) => kinds.includes(e.kind) && Number.isFinite(e.atMs))
    .map((e) => e.atMs)
    .sort((a, b) => a - b);
  const countUpTo = (t: number): number => {
    let n = 0;
    while (n < times.length && times[n] <= t) n += 1;
    return n;
  };
  const points: SeriesPoint[] = [];
  for (const t of seriesGrid(axisMs, buckets)) {
    if (t > end) break;
    points.push({ t, v: countUpTo(t) });
  }
  if (points.length === 0 || points[points.length - 1].t < end) {
    points.push({ t: end, v: countUpTo(end) });
  }
  return points;
}

/** 구간 목록과의 교집합으로 잘라낸다(검사된 구간만 남기기). */
export function clipBands<T extends TimeBand>(
  bands: readonly T[],
  intervals: readonly ScannedInterval[],
): T[] {
  const out: T[] = [];
  for (const band of bands) {
    for (const it of intervals) {
      const fromMs = Math.max(band.fromMs, it.fromMs);
      const toMs = Math.min(band.toMs, it.toMs);
      if (toMs > fromMs) out.push({ ...band, fromMs, toMs });
    }
  }
  return out;
}

/**
 * 한 장비의 상태 밴드 — 전이 시각 사이 구간에 `to` 상태, 마지막 전이는 창
 * 끝까지. 첫 전이 전(unknown)은 그리지 않는다. `scanned` 를 주면 검사된
 * 구간만 남긴다.
 */
export function statusBands(
  transitions: readonly StatusTransition[],
  modelId: string,
  windowEndMs: number,
  scanned?: readonly ScannedInterval[],
): StatusBand[] {
  const end = Number.isFinite(windowEndMs) ? Math.max(0, windowEndMs) : 0;
  const own = transitions
    .filter((t) => t.modelId === modelId && Number.isFinite(t.atMs))
    .sort((a, b) => a.atMs - b.atMs);
  const bands: StatusBand[] = [];
  for (let i = 0; i < own.length; i += 1) {
    const fromMs = Math.max(0, own[i].atMs);
    const toMs = Math.min(end, i + 1 < own.length ? own[i + 1].atMs : end);
    if (toMs <= fromMs) continue;
    bands.push({ fromMs, toMs, status: own[i].to });
  }
  return scanned ? clipBands(bands, scanned) : bands;
}

/** 영역 진입·이탈 짝짓기 → 체류 밴드. 이탈 없는 진입은 창 끝까지(open). */
export function zoneBands(
  events: readonly Play3dEvent[],
  windowEndMs: number,
): ZoneBand[] {
  const end = Number.isFinite(windowEndMs) ? Math.max(0, windowEndMs) : 0;
  const sorted = events
    .filter(
      (e) =>
        (e.kind === 'zoneEnter' || e.kind === 'zoneExit') &&
        Number.isFinite(e.atMs) &&
        e.atMs <= end,
    )
    .sort((a, b) => a.atMs - b.atMs || a.id - b.id);
  const open = new Map<string, Play3dEvent>();
  const out: ZoneBand[] = [];
  const close = (enter: Play3dEvent, toMs: number, isOpen: boolean) => {
    out.push({
      fromMs: enter.atMs,
      toMs: Math.max(enter.atMs, toMs),
      zoneKey: enter.zoneKey ?? enter.subject,
      zoneName: enter.zoneName ?? enter.zoneKey ?? enter.subject,
      level: enter.level ?? 'warn',
      intruderId: enter.intruderId ?? enter.subject,
      intruderName: enter.intruderName ?? enter.intruderId ?? enter.subject,
      open: isOpen,
    });
  };
  for (const e of sorted) {
    if (e.kind === 'zoneEnter') {
      const prev = open.get(e.subject);
      if (prev) close(prev, e.atMs, false);
      open.set(e.subject, e);
    } else {
      const prev = open.get(e.subject);
      if (!prev) continue;
      open.delete(e.subject);
      close(prev, e.atMs, false);
    }
  }
  for (const [, enter] of open) close(enter, end, true);
  return out.sort((a, b) => a.fromMs - b.fromMs);
}

/** 정지 시작·해제 짝짓기 → 정지 밴드(씬 시간은 정지 중 흐르지 않아 폭은 0 에 가깝다). */
export function holdBands(
  events: readonly Play3dEvent[],
  windowEndMs: number,
): HoldBand[] {
  const end = Number.isFinite(windowEndMs) ? Math.max(0, windowEndMs) : 0;
  const sorted = events
    .filter(
      (e) =>
        (e.kind === 'holdStart' || e.kind === 'holdEnd') &&
        Number.isFinite(e.atMs) &&
        e.atMs <= end,
    )
    .sort((a, b) => a.atMs - b.atMs || a.id - b.id);
  const out: HoldBand[] = [];
  let current: Play3dEvent | null = null;
  for (const e of sorted) {
    if (e.kind === 'holdStart') {
      if (current) {
        out.push({
          fromMs: current.atMs,
          toMs: e.atMs,
          subject: current.subject,
        });
      }
      current = e;
    } else if (current) {
      out.push({
        fromMs: current.atMs,
        toMs: e.atMs,
        subject: current.subject,
      });
      current = null;
    }
  }
  if (current)
    out.push({ fromMs: current.atMs, toMs: end, subject: current.subject });
  return out;
}

/**
 * 가동 비율 누적 시리즈 — 격자 시각 t 마다 "[0,t] ∩ 검사 구간 안에서 running
 * 이었던 시간 ÷ 상태를 아는(unknown 제외) 시간". 분모 0 이면 점을 만들지
 * 않는다.
 */
export function runningRatioSeries(
  transitions: readonly StatusTransition[],
  scanned: readonly ScannedInterval[],
  axisMs: number,
  windowEndMs: number,
  buckets = 60,
): SeriesPoint[] {
  const end = Number.isFinite(windowEndMs) ? Math.max(0, windowEndMs) : 0;
  const modelIds = [...new Set(transitions.map((t) => t.modelId))];
  const bands = modelIds.flatMap((id) =>
    statusBands(transitions, id, end, scanned),
  );
  const overlapUpTo = (
    t: number,
    pick: (s: EquipmentRuntimeStatus) => boolean,
  ) => {
    let sum = 0;
    for (const b of bands) {
      if (!pick(b.status)) continue;
      const toMs = Math.min(b.toMs, t);
      if (toMs > b.fromMs) sum += toMs - b.fromMs;
    }
    return sum;
  };
  const points: SeriesPoint[] = [];
  const grid = seriesGrid(axisMs, buckets).filter((t) => t <= end);
  if (grid.length === 0 || grid[grid.length - 1] < end) grid.push(end);
  for (const t of grid) {
    const known = overlapUpTo(t, (s) => s !== 'unknown');
    if (known <= 0) continue;
    points.push({ t, v: overlapUpTo(t, (s) => s === 'running') / known });
  }
  return points;
}

/** 상위 N — 정렬은 호출자가 이미 했다고 보고 앞에서 자른다(동률은 원래 순서). */
export function topN<T>(items: readonly T[], n: number): T[] {
  return items.slice(0, Math.max(0, n));
}

export interface ZoneIntruderRank {
  zoneKey: string;
  zoneName: string;
  level: 'warn' | 'stop';
  intruderId: string;
  intruderName: string;
  count: number;
}

/** 영역×침범자 상위 N(횟수 내림차순, 동률은 영역 순서·침범자 순서). */
export function rankZoneIntruders(
  zones: readonly ZoneStat[],
  n: number,
): ZoneIntruderRank[] {
  const rows: ZoneIntruderRank[] = [];
  for (const z of zones) {
    for (const r of z.byIntruder) {
      rows.push({
        zoneKey: z.zoneKey,
        zoneName: z.zoneName,
        level: z.level,
        intruderId: r.intruderId,
        intruderName: r.intruderName,
        count: r.count,
      });
    }
  }
  rows.sort((a, b) => b.count - a.count);
  return topN(rows, n);
}

export interface TagRangeBar {
  /** 0~1 정규화 위치. */
  min: number;
  mean: number;
  max: number;
  /** 정규화 기준 범위(정의 범위 또는 관측 범위). */
  lo: number;
  hi: number;
}

/**
 * 태그 range bar — `range`(가상 태그 정의 min~max)가 있으면 그 안에서, 없으면
 * 관측 min~max 를 기준으로 min·평균·max 위치를 0~1 로 정규화한다. 범위 밖
 * 값은 clamp, 관측 0 건·비정상 값은 null.
 */
export function tagRangeBar(
  agg: Pick<TagAggregate, 'min' | 'max' | 'sum' | 'count'>,
  range: { min: number; max: number } | null,
): TagRangeBar | null {
  if (
    agg.count <= 0 ||
    !Number.isFinite(agg.min) ||
    !Number.isFinite(agg.max)
  ) {
    return null;
  }
  const mean = agg.sum / agg.count;
  let lo = range && Number.isFinite(range.min) ? range.min : agg.min;
  let hi = range && Number.isFinite(range.max) ? range.max : agg.max;
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi === lo) hi = lo + 1;
  const norm = (v: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return { min: norm(agg.min), mean: norm(mean), max: norm(agg.max), lo, hi };
}
