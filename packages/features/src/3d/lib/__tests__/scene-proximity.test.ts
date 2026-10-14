import { describe, expect, it } from 'vitest';
import {
  isProximityOutlineEqual,
  dangerModelIds,
  proximityModelIds,
  proximityLevelById,
  PROXIMITY_FOCUS_MAX_M,
  PROXIMITY_FOCUS_MIN_M,
  proximityFocusPose,
  PROXIMITY_DANGER_M,
  PROXIMITY_WARN_M,
  formatProximityGap,
  isProximityPairsEqual,
  resolveProximityLevel,
  type ProximityPair,
} from '../scene-proximity';

const pair = (over: Partial<ProximityPair> = {}): ProximityPair => ({
  key: 'a|b',
  a: 'a',
  b: 'b',
  gapM: 12,
  level: 'warn',
  from: [0, 0, 0],
  to: [10, 0, 0],
  ...over,
});

describe('resolveProximityLevel', () => {
  it('경계 정확값 포함 — 위험 ≤ DANGER, 주의 ≤ WARN, 그 밖은 null', () => {
    expect(resolveProximityLevel(PROXIMITY_DANGER_M)).toBe('danger');
    expect(resolveProximityLevel(PROXIMITY_DANGER_M + 0.01)).toBe('warn');
    expect(resolveProximityLevel(PROXIMITY_WARN_M)).toBe('warn');
    expect(resolveProximityLevel(PROXIMITY_WARN_M + 0.01)).toBeNull();
    // 간격 0(겹침)은 충돌 후보라 근접에서 뺀다 — 충돌 검출기의 몫.
    expect(resolveProximityLevel(0)).toBeNull();
    expect(resolveProximityLevel(-1)).toBeNull();
    expect(resolveProximityLevel(0.01)).toBe('danger');
    expect(resolveProximityLevel(NaN)).toBeNull();
    expect(resolveProximityLevel(Infinity)).toBeNull();
  });
});

describe('isProximityPairsEqual', () => {
  it('키·등급·0.1 m 간격·끝점 0.5 unit 안이면 같다', () => {
    expect(isProximityPairsEqual([pair()], [pair({ gapM: 12.04 })])).toBe(true);
    expect(isProximityPairsEqual([pair()], [pair({ gapM: 12.3 })])).toBe(false);
    expect(isProximityPairsEqual([pair()], [pair({ level: 'danger' })])).toBe(
      false,
    );
    expect(isProximityPairsEqual([pair()], [pair({ to: [10.4, 0, 0] })])).toBe(
      true,
    );
    expect(isProximityPairsEqual([pair()], [pair({ to: [11, 0, 0] })])).toBe(
      false,
    );
    expect(isProximityPairsEqual([pair()], [])).toBe(false);
    expect(isProximityPairsEqual([], [])).toBe(true);
  });
});

describe('formatProximityGap', () => {
  it('소수 1자리 m, 음수는 0, 겹침 라벨을 주면 0 이하는 그 문구', () => {
    expect(formatProximityGap(12.345)).toBe('12.3 m');
    expect(formatProximityGap(-1)).toBe('0.0 m');
    expect(formatProximityGap(0, '겹침')).toBe('겹침');
    expect(formatProximityGap(0.04, '겹침')).toBe('0.0 m');
  });
});

describe('proximityFocusPose', () => {
  it('타깃은 선의 가운데, 거리는 간격에 비례하되 하한·상한(m)을 unit 로 환산', () => {
    const near = proximityFocusPose([0, 0, 0], [10, 0, 0], 0, 1);
    expect(near.target).toEqual([5, 0, 0]);
    const dNear = Math.hypot(
      near.position[0] - 5,
      near.position[1],
      near.position[2],
    );
    expect(dNear).toBeCloseTo(PROXIMITY_FOCUS_MIN_M, 6);
    const far = proximityFocusPose([0, 0, 0], [10, 0, 0], 1000, 1);
    expect(
      Math.hypot(far.position[0] - 5, far.position[1], far.position[2]),
    ).toBeCloseTo(PROXIMITY_FOCUS_MAX_M, 6);
    // 11.7 m/unit 씬이면 unit 거리는 그만큼 짧다.
    const scaled = proximityFocusPose([0, 0, 0], [0, 0, 0], 0, 10);
    expect(
      Math.hypot(scaled.position[0], scaled.position[1], scaled.position[2]),
    ).toBeCloseTo(PROXIMITY_FOCUS_MIN_M / 10, 6);
    expect(scaled.position[1]).toBeGreaterThan(0);
  });
});

describe('dangerModelIds', () => {
  const base = { gapM: 1, from: [0, 0, 0] as const, to: [1, 0, 0] as const };
  const pairs = [
    { key: 'x', a: 'A', b: 'B', level: 'danger' as const, ...base },
    { key: 'y', a: 'B', b: 'C', level: 'warn' as const, ...base },
  ].map((p) => ({
    ...p,
    from: [...p.from] as [number, number, number],
    to: [...p.to] as [number, number, number],
  }));
  it('위험 쌍의 모델만 모은다(중복 없음)', () => {
    expect([...dangerModelIds(pairs)].sort()).toEqual(['A', 'B']);
    expect(dangerModelIds([]).size).toBe(0);
  });
  it('모델별 최악 등급 — 위험이 주의를 덮는다', () => {
    expect(proximityLevelById(pairs)).toEqual({
      A: 'danger',
      B: 'danger',
      C: 'warn',
    });
    expect(proximityLevelById([])).toEqual({});
  });
  it('근접 쌍(주의 포함)의 모델 전부', () => {
    expect([...proximityModelIds(pairs)].sort()).toEqual(['A', 'B', 'C']);
    expect(proximityModelIds([]).size).toBe(0);
  });
});

describe('isProximityOutlineEqual', () => {
  const base = {
    gapM: 1,
    from: [0, 0, 0] as [number, number, number],
    to: [1, 0, 0] as [number, number, number],
  };
  it('키·등급만 비교하고 간격·끝점은 무시', () => {
    const a = [{ key: 'x', a: 'A', b: 'B', level: 'warn' as const, ...base }];
    expect(
      isProximityOutlineEqual(a, [{ ...a[0]!, gapM: 99, from: [5, 5, 5] }]),
    ).toBe(true);
    expect(isProximityOutlineEqual(a, [{ ...a[0]!, level: 'danger' }])).toBe(
      false,
    );
    expect(isProximityOutlineEqual(a, [{ ...a[0]!, key: 'y' }])).toBe(false);
    expect(isProximityOutlineEqual(a, [])).toBe(false);
    expect(isProximityOutlineEqual([], [])).toBe(true);
  });
});
