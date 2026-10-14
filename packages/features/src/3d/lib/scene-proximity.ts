import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 근접 쌍 표시의 순수 판정·상수 — 모델↔모델 AABB 간격(m)으로 등급을 나눈다.
 *
 * 관제사가 봐야 할 것은 크레인이 아니라 "어느 둘이 가까운가" 라, 가까운 쌍
 * 사이에 거리 선과 미터 표시를 띄우고 그 두 모델에 외곽선을 준다. 간격은
 * 충돌 런타임이 매 스캔 갱신하는 모델 AABB 끼리의 유클리드 간격이다 —
 * 삼각형 거리가 아니라 보수적(실제보다 작거나 같다)이고 비용이 0 에 가깝다.
 * 상자가 겹치면 0(붐이 상대 위를 지나는 동안도 0 — 과경보 쪽으로 틀린다).
 */

/** 이 간격(m) 안이면 선을 그린다(황색). */
export const PROXIMITY_WARN_M = 30;
/** 이 간격(m) 안이면 위험(적색). */
export const PROXIMITY_DANGER_M = 10;
/** 한 번에 보이는 최대 쌍 수 — 가까운 순. */
export const PROXIMITY_MAX_PAIRS = 6;
/** 스토어 갱신 주기(ms). 선·라벨은 React 요소라 프레임 속도로 갱신하지 않는다. */
export const PROXIMITY_UPDATE_MS = 250;

export type ProximityLevel = 'warn' | 'danger';

export interface ProximityPair {
  key: string;
  a: string;
  b: string;
  /** 간격(m). 0 = AABB 겹침. */
  gapM: number;
  level: ProximityLevel;
  /** 선의 양 끝(씬 unit, 월드). */
  from: Vector3Tuple;
  to: Vector3Tuple;
}

/** 모델 id → 가장 나쁜 근접 등급(미니맵 마커 색). */
export function proximityLevelById(
  pairs: readonly ProximityPair[],
): Record<string, ProximityLevel> {
  const out: Record<string, ProximityLevel> = {};
  for (const p of pairs) {
    for (const id of [p.a, p.b]) {
      if (p.level === 'danger' || out[id] === undefined) out[id] = p.level;
    }
  }
  return out;
}

/** 근접(주의·위험) 쌍에 속한 모델 id 집합 — 관제 모드 바닥 링은 이들에게만. */
export function proximityModelIds(
  pairs: readonly ProximityPair[],
): Set<string> {
  const out = new Set<string>();
  for (const p of pairs) {
    out.add(p.a);
    out.add(p.b);
  }
  return out;
}

/** 위험 쌍에 속한 모델 id 집합(링 맥동·강조용). */
export function dangerModelIds(pairs: readonly ProximityPair[]): Set<string> {
  const out = new Set<string>();
  for (const p of pairs) {
    if (p.level === 'danger') {
      out.add(p.a);
      out.add(p.b);
    }
  }
  return out;
}

/**
 * 간격 0(AABB 겹침)은 근접이 아니라 **충돌 후보**라 여기서 뺀다 — 실제 충돌은
 * 충돌 검출기가 적색 실루엣·배지로 따로 보이고, 붐이 상대 위를 지나는
 * 겹침은 "겹침" 표시만 늘려 시야를 가렸다.
 */
export function resolveProximityLevel(gapM: number): ProximityLevel | null {
  if (!Number.isFinite(gapM) || gapM <= 0 || gapM > PROXIMITY_WARN_M) {
    return null;
  }
  return gapM <= PROXIMITY_DANGER_M ? 'danger' : 'warn';
}

/** 표시가 바뀌었는지 — 키·등급·간격(0.1 m 단위) 만 본다. 끝점 미세 이동은 무시. */
export function isProximityPairsEqual(
  a: readonly ProximityPair[],
  b: readonly ProximityPair[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.key !== y.key ||
      x.level !== y.level ||
      Math.round(x.gapM * 10) !== Math.round(y.gapM * 10) ||
      Math.abs(x.from[0] - y.from[0]) > 0.5 ||
      Math.abs(x.from[1] - y.from[1]) > 0.5 ||
      Math.abs(x.from[2] - y.from[2]) > 0.5 ||
      Math.abs(x.to[0] - y.to[0]) > 0.5 ||
      Math.abs(x.to[1] - y.to[1]) > 0.5 ||
      Math.abs(x.to[2] - y.to[2]) > 0.5
    ) {
      return false;
    }
  }
  return true;
}

/**
 * 외곽선·맥동용 "같은 쌍 집합인가" — 키와 등급만 본다. 간격 0.1 m 변화마다
 * 모니터링 뷰 전체(모델 수십 개의 외곽선 prop)가 리렌더되지 않게 스토어가
 * 이 기준으로 별도 슬라이스(outlinePairs)를 든다.
 */
export function isProximityOutlineEqual(
  a: readonly ProximityPair[],
  b: readonly ProximityPair[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]!.key !== b[i]!.key || a[i]!.level !== b[i]!.level) return false;
  }
  return true;
}

export const PROXIMITY_LINE_COLORS: Record<ProximityLevel, string> = {
  warn: '#ffd400',
  danger: '#ff2d2d',
};

/**
 * 근접 쌍을 보는 카메라 포즈 — 선의 가운데를 타깃으로, 남동쪽 위에서 비스듬히.
 * 거리는 간격에 비례하되 두 장비가 들어오도록 하한·상한(m)을 둔다. 씬 unit 로
 * 돌려준다.
 */
export const PROXIMITY_FOCUS_MIN_M = 60;
export const PROXIMITY_FOCUS_MAX_M = 220;

export function proximityFocusPose(
  from: Vector3Tuple,
  to: Vector3Tuple,
  gapM: number,
  metersPerUnit: number,
): { position: Vector3Tuple; target: Vector3Tuple } {
  const target: Vector3Tuple = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  ];
  const mpu = metersPerUnit > 0 ? metersPerUnit : 1;
  const distM = Math.min(
    PROXIMITY_FOCUS_MAX_M,
    Math.max(PROXIMITY_FOCUS_MIN_M, gapM * 3 + PROXIMITY_FOCUS_MIN_M),
  );
  const d = distM / mpu;
  // 방향 (0.5, 0.75, 0.5) 정규화 — 위에서 비스듬히.
  const n = Math.sqrt(0.5 * 0.5 + 0.75 * 0.75 + 0.5 * 0.5);
  return {
    position: [
      target[0] + (0.5 / n) * d,
      target[1] + (0.75 / n) * d,
      target[2] + (0.5 / n) * d,
    ],
    target,
  };
}

/**
 * 거리 표기. 간격 0 은 상자가 겹친 것이라 숫자 대신 `overlapLabel`(호출자가
 * 번역해 넘긴다 — "겹침")을 쓴다. 라벨이 없으면 0.0 m.
 */
export function formatProximityGap(
  gapM: number,
  overlapLabel?: string,
): string {
  if (overlapLabel && gapM <= 0) return overlapLabel;
  return `${Math.max(0, gapM).toFixed(1)} m`;
}
