import { describe, expect, it } from 'vitest';
import {
  PLAN_SCALE_BAR_MAX_PX,
  formatPlanScale,
  orthoPixelsPerUnit,
  resolvePlanScaleBar,
} from '../plan-scale-bar';

describe('orthoPixelsPerUnit', () => {
  it('zoom × 높이 / 프러스텀 높이', () => {
    expect(orthoPixelsPerUnit(1, 100, -100, 1000)).toBe(5);
    expect(orthoPixelsPerUnit(2, 100, -100, 1000)).toBe(10);
  });

  it('0 이하·비유한수는 NaN', () => {
    expect(orthoPixelsPerUnit(0, 100, -100, 1000)).toBeNaN();
    expect(orthoPixelsPerUnit(1, -100, 100, 1000)).toBeNaN();
    expect(orthoPixelsPerUnit(1, 100, -100, 0)).toBeNaN();
    expect(orthoPixelsPerUnit(Number.NaN, 100, -100, 1000)).toBeNaN();
    expect(orthoPixelsPerUnit(1, Number.POSITIVE_INFINITY, 0, 1000)).toBeNaN();
  });
});

describe('resolvePlanScaleBar', () => {
  it('상한 px 안에서 가장 긴 1·2·5×10ⁿ m 를 고른다', () => {
    // 1 px/m, 상한 140 → 100 m.
    expect(resolvePlanScaleBar(1)).toEqual({
      meters: 100,
      px: 100,
      label: '100 m',
    });
    // 2 px/m → 70 m 이하 → 50 m = 100 px.
    expect(resolvePlanScaleBar(2)).toMatchObject({ meters: 50, px: 100 });
    // 0.5 px/m → 280 m 이하 → 200 m = 100 px.
    expect(resolvePlanScaleBar(0.5)).toMatchObject({ meters: 200, px: 100 });
  });

  it('경계 정확값은 통과, 살짝 넘으면 한 단계 아래', () => {
    // 상한 100 px, 1 px/m → 정확히 100 m.
    expect(resolvePlanScaleBar(1, 100)!.meters).toBe(100);
    // 1.001 px/m → 100 m 는 100.1 px 로 초과 → 50 m.
    expect(resolvePlanScaleBar(1.001, 100)!.meters).toBe(50);
  });

  it('결과 px 는 상한의 2/5 이상이다', () => {
    for (const ppm of [0.013, 0.07, 0.31, 1.9, 4.4, 23, 170]) {
      const bar = resolvePlanScaleBar(ppm)!;
      expect(bar.px).toBeLessThanOrEqual(PLAN_SCALE_BAR_MAX_PX);
      expect(bar.px).toBeGreaterThanOrEqual(PLAN_SCALE_BAR_MAX_PX * 0.4 - 1e-9);
    }
  });

  it('축척을 알 수 없으면 null', () => {
    expect(resolvePlanScaleBar(Number.NaN)).toBeNull();
    expect(resolvePlanScaleBar(0)).toBeNull();
    expect(resolvePlanScaleBar(-1)).toBeNull();
    expect(resolvePlanScaleBar(Number.POSITIVE_INFINITY)).toBeNull();
    expect(resolvePlanScaleBar(1, 0)).toBeNull();
  });
});

describe('formatPlanScale', () => {
  it('m · km · cm', () => {
    expect(formatPlanScale(50)).toBe('50 m');
    expect(formatPlanScale(1000)).toBe('1 km');
    expect(formatPlanScale(2000)).toBe('2 km');
    expect(formatPlanScale(0.5)).toBe('50 cm');
  });

  it('0 이하·비유한수는 빈 문자열', () => {
    expect(formatPlanScale(0)).toBe('');
    expect(formatPlanScale(Number.NaN)).toBe('');
  });
});
