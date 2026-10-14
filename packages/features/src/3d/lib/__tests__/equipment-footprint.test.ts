import { describe, expect, it } from 'vitest';
import {
  FOOTPRINT_PULSE_MAX,
  FOOTPRINT_PULSE_MIN,
  FOOTPRINT_PULSE_PERIOD_MS,
  footprintPulseOpacity,
  FOOTPRINT_DEFAULT_COLOR,
  FOOTPRINT_RADIUS_MAX,
  FOOTPRINT_RADIUS_MIN,
  footprintColor,
  footprintRadius,
} from '../equipment-footprint';

describe('footprintRadius', () => {
  it('긴 축의 반범위, 범위로 클램프, 비유한은 하한', () => {
    expect(footprintRadius(10, 30)).toBe(30);
    expect(footprintRadius(-50, 3)).toBe(50);
    expect(footprintRadius(0.1, 0.1)).toBe(FOOTPRINT_RADIUS_MIN);
    expect(footprintRadius(10_000, 1)).toBe(FOOTPRINT_RADIUS_MAX);
    expect(footprintRadius(NaN, 1)).toBe(FOOTPRINT_RADIUS_MIN);
  });
});

describe('footprintPulseOpacity', () => {
  it('주기 시작은 MIN, 반주기는 MAX, 한 주기 뒤 다시 MIN, 비유한은 MAX', () => {
    expect(footprintPulseOpacity(0)).toBeCloseTo(FOOTPRINT_PULSE_MIN, 6);
    expect(footprintPulseOpacity(FOOTPRINT_PULSE_PERIOD_MS / 2)).toBeCloseTo(
      FOOTPRINT_PULSE_MAX,
      6,
    );
    expect(footprintPulseOpacity(FOOTPRINT_PULSE_PERIOD_MS)).toBeCloseTo(
      FOOTPRINT_PULSE_MIN,
      6,
    );
    expect(footprintPulseOpacity(NaN)).toBe(FOOTPRINT_PULSE_MAX);
    for (const t of [10, 333, 777, 1000]) {
      const v = footprintPulseOpacity(t);
      expect(v).toBeGreaterThanOrEqual(FOOTPRINT_PULSE_MIN);
      expect(v).toBeLessThanOrEqual(FOOTPRINT_PULSE_MAX);
    }
  });
});

describe('footprintColor', () => {
  it('없음·none·contour 는 기본 회백, 상태는 그 외곽선 색', () => {
    expect(footprintColor(undefined)).toBe(FOOTPRINT_DEFAULT_COLOR);
    expect(footprintColor('none')).toBe(FOOTPRINT_DEFAULT_COLOR);
    expect(footprintColor('contour')).toBe(FOOTPRINT_DEFAULT_COLOR);
    expect(footprintColor('endstop')).toBe('#ff0000');
    expect(footprintColor('slowdown')).toBe('#ffff00');
  });
});
