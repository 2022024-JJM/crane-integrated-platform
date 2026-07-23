import { getStorageJson, setStorageJson } from '@crane/core/lib/safe-storage';
import type { AlarmZone, AxisKey, MasterKind } from './types';

/** 한 축의 충돌 기준값(m). 미속 경계는 정지~근접 중간값으로 파생 (매뉴얼 2.3: 미속거리는 속도 가변) */
export interface AxisLimits {
  safe: number;
  stop: number;
  near: number;
}

export type CollisionLimits = Record<
  MasterKind,
  Partial<Record<AxisKey, AxisLimits>>
>;

const STORAGE_KEY = 'hmi-collision-limits';

const FALLBACK: AxisLimits = { safe: 3, stop: 6, near: 12 };

/** 매뉴얼 2.3 권장값 (TC/TTC, GC, OC/CC) */
export const DEFAULT_LIMITS: CollisionLimits = {
  TTC: {
    traverse: { safe: 3, stop: 6, near: 8 },
    slew: { safe: 3, stop: 8, near: 25 },
    travel: { safe: 3, stop: 8, near: 12 },
  },
  GC: {
    ut: { safe: 3, stop: 5, near: 8 },
    lt: { safe: 3, stop: 5, near: 8 },
    travel: { safe: 3, stop: 6, near: 12 },
  },
  OC: {
    luff: { safe: 3, stop: 5, near: 8 },
    slew: { safe: 3, stop: 8, near: 25 },
    travel: { safe: 3, stop: 6, near: 12 },
  },
};

export function axisLimits(
  limits: CollisionLimits,
  kind: MasterKind,
  axis: AxisKey,
): AxisLimits {
  return limits[kind]?.[axis] ?? DEFAULT_LIMITS[kind][axis] ?? FALLBACK;
}

export const slowOf = (l: AxisLimits) => (l.stop + l.near) / 2;

export function zoneOf(d: number, l: AxisLimits): AlarmZone {
  if (d <= l.stop) return 'stop';
  if (d <= slowOf(l)) return 'slow';
  if (d <= l.near) return 'near';
  return 'none';
}

export function loadLimits(): CollisionLimits {
  const stored = getStorageJson<CollisionLimits>(STORAGE_KEY);
  if (!stored) return DEFAULT_LIMITS;
  // 저장본 위에 기본값 병합 — 이후 축이 추가되어도 안전
  const merged = {} as CollisionLimits;
  for (const kind of Object.keys(DEFAULT_LIMITS) as MasterKind[]) {
    merged[kind] = { ...DEFAULT_LIMITS[kind], ...stored[kind] };
  }
  return merged;
}

export function saveLimits(limits: CollisionLimits): void {
  setStorageJson(STORAGE_KEY, limits);
}
