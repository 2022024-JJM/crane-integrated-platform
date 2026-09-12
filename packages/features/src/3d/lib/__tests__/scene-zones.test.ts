import { describe, expect, it } from 'vitest';
import { SEPARATION_MARGIN } from '../scene-collision-pairs';
import {
  ZONE_EXIT_MARGIN_RATIO,
  zoneColorWithAlpha,
  zoneExitMargin,
  zoneGroundLift,
  zoneKey,
  zonePulsePhase,
  zoneRingOpacity,
} from '../scene-zones';

describe('zoneExitMargin', () => {
  it('작은 반경은 SEPARATION_MARGIN 바닥값', () => {
    expect(zoneExitMargin(0.5)).toBe(SEPARATION_MARGIN);
    // 바닥값과 비례값이 같아지는 반경
    expect(zoneExitMargin(SEPARATION_MARGIN / ZONE_EXIT_MARGIN_RATIO)).toBe(
      SEPARATION_MARGIN,
    );
  });

  it('큰 반경은 비례 — r=60 → 1.8', () => {
    expect(zoneExitMargin(60)).toBeCloseTo(1.8);
  });

  it('NaN·0·음수는 바닥값', () => {
    expect(zoneExitMargin(Number.NaN)).toBe(SEPARATION_MARGIN);
    expect(zoneExitMargin(0)).toBe(SEPARATION_MARGIN);
    expect(zoneExitMargin(-3)).toBe(SEPARATION_MARGIN);
  });
});

describe('zoneKey', () => {
  it('모델 id 와 영역 id 를 # 로 잇는다', () => {
    expect(zoneKey('m1', 'z1')).toBe('m1#z1');
    expect(zoneKey('m1', 'z1')).not.toBe(zoneKey('m1z', '1'));
  });
});

describe('zoneGroundLift', () => {
  it('최소 0.03, 반경 0.5% 비례, 무효 반경은 최소값', () => {
    expect(zoneGroundLift(1)).toBe(0.03);
    expect(zoneGroundLift(6)).toBe(0.03);
    expect(zoneGroundLift(60)).toBeCloseTo(0.3);
    expect(zoneGroundLift(Number.NaN)).toBe(0.03);
  });
});

describe('zoneRingOpacity', () => {
  it('idle 은 희미한 면·또렷한 테두리', () => {
    expect(zoneRingOpacity(false, 0.5, false)).toEqual({
      fill: 0.05,
      ring: 0.8,
    });
  });

  it('침범 중엔 위상에 따라 면이 차오르고 테두리는 1', () => {
    expect(zoneRingOpacity(true, 0, false)).toEqual({ fill: 0.14, ring: 1 });
    expect(zoneRingOpacity(true, 1, false).fill).toBeCloseTo(0.3);
    // 위상 범위 밖·NaN 은 clamp
    expect(zoneRingOpacity(true, 7, false).fill).toBeCloseTo(0.3);
    expect(zoneRingOpacity(true, Number.NaN, false).fill).toBe(0.14);
  });

  it('reduced-motion 이면 맥동 없이 고정값', () => {
    expect(zoneRingOpacity(true, 0, true)).toEqual(
      zoneRingOpacity(true, 1, true),
    );
    expect(zoneRingOpacity(true, 0, true).ring).toBe(1);
  });
});

describe('zonePulsePhase', () => {
  it('0~1 범위, 2Hz 주기', () => {
    expect(zonePulsePhase(0)).toBeCloseTo(0.5);
    expect(zonePulsePhase(0.125)).toBeCloseTo(1);
    expect(zonePulsePhase(0.375)).toBeCloseTo(0);
    expect(zonePulsePhase(0.5)).toBeCloseTo(0.5);
  });
});

describe('zoneColorWithAlpha', () => {
  it('hex 를 rgba 로 바꾸고 알파를 clamp 한다', () => {
    expect(zoneColorWithAlpha('#38bdf8', 0.5)).toBe('rgba(56, 189, 248, 0.5)');
    expect(zoneColorWithAlpha('#FF0000', 2)).toBe('rgba(255, 0, 0, 1)');
    expect(zoneColorWithAlpha('#ff0000', -1)).toBe('rgba(255, 0, 0, 0)');
  });

  it('형식이 아니면 회색 폴백', () => {
    expect(zoneColorWithAlpha('red', 0.3)).toBe('rgba(148, 163, 184, 0.3)');
    expect(zoneColorWithAlpha('#fff', 1)).toBe('rgba(148, 163, 184, 1)');
  });
});
