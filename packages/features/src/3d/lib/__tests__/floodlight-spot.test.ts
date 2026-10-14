import { describe, expect, it } from 'vitest';
import type { SavedFloodlightInfo } from '@crane/domain/3d';
import {
  FLOODLIGHT_AIM_IRRADIANCE,
  FLOODLIGHT_CUTOFF_RATIO,
  FLOODLIGHT_PENUMBRA,
  resolveFloodlightSpot,
} from '../floodlight-spot';

function light(
  overrides: Partial<SavedFloodlightInfo> = {},
): SavedFloodlightInfo {
  return {
    id: 'f1',
    name: '',
    position: [0, 30, 0],
    aim: [0, -30, 0],
    ...overrides,
  };
}

describe('resolveFloodlightSpot', () => {
  it('칸델라 = 기준 조도 × 세기 배율 × 조준 거리² — 높이가 달라도 바닥 밝기가 같다', () => {
    const near = resolveFloodlightSpot(light({ aim: [0, -10, 0] }));
    const far = resolveFloodlightSpot(light({ aim: [0, -40, 0] }));
    expect(near.candela).toBeCloseTo(FLOODLIGHT_AIM_IRRADIANCE * 100, 10);
    expect(far.candela).toBeCloseTo(FLOODLIGHT_AIM_IRRADIANCE * 1600, 10);
    // 조준점 조도 I/d² 는 둘이 같다.
    expect(near.candela / 100).toBeCloseTo(far.candela / 1600, 10);
  });

  it('세기 배율은 칸델라에 비례한다', () => {
    const base = resolveFloodlightSpot(light());
    const doubled = resolveFloodlightSpot(light({ intensity: 2 }));
    expect(doubled.candela).toBeCloseTo(base.candela * 2, 10);
  });

  it('컷오프 = 조준 거리 × 비율, 반각은 라디안, 페넘브라는 상수', () => {
    const spot = resolveFloodlightSpot(light({ aim: [30, -40, 0], angle: 45 }));
    expect(spot.distance).toBeCloseTo(50 * FLOODLIGHT_CUTOFF_RATIO, 10);
    expect(spot.angle).toBeCloseTo(Math.PI / 4, 10);
    expect(spot.penumbra).toBe(FLOODLIGHT_PENUMBRA);
  });
});
