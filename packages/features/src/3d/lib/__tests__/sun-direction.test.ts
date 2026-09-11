import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  SCENE_SUN_AZIMUTH_DEFAULT,
  SCENE_SUN_ELEVATION_DEFAULT,
  SCENE_SUN_ELEVATION_MIN,
} from '@crane/domain/3d';
import { sunDirectionFromAngles } from '../sun-direction';

describe('sunDirectionFromAngles', () => {
  it('구성상 단위 벡터다', () => {
    for (const [az, el] of [
      [0, 30],
      [90, 45],
      [217, 88],
      [359, SCENE_SUN_ELEVATION_MIN],
    ]) {
      expect(sunDirectionFromAngles(az, el).length()).toBeCloseTo(1, 12);
    }
  });

  it('나침반 방위 규약 — +X = 동, -Z = 북', () => {
    const north = sunDirectionFromAngles(0, 45);
    expect(north.x).toBeCloseTo(0, 12);
    expect(north.z).toBeLessThan(0);

    const east = sunDirectionFromAngles(90, 45);
    expect(east.x).toBeGreaterThan(0);
    expect(east.z).toBeCloseTo(0, 12);

    const south = sunDirectionFromAngles(180, 45);
    expect(south.x).toBeCloseTo(0, 12);
    expect(south.z).toBeGreaterThan(0);
  });

  it('고도는 [MIN, 90]로 클램프한다 — 90이면 머리 위', () => {
    const belowMin = sunDirectionFromAngles(0, 0);
    expect(belowMin).toEqual(
      sunDirectionFromAngles(0, SCENE_SUN_ELEVATION_MIN),
    );

    const overhead = sunDirectionFromAngles(123, 90);
    expect(overhead.y).toBeCloseTo(1, 12);
  });

  it('세 번째 인자로 하한을 낮추면 그 아래 고도도 그대로 쓴다 (solar·표식용)', () => {
    const low = sunDirectionFromAngles(90, 5, 0);
    expect(low.y).toBeCloseTo(Math.sin((5 * Math.PI) / 180), 12);
    const below = sunDirectionFromAngles(90, -20, -90);
    expect(below.y).toBeLessThan(0);
    // 하한보다 낮은 값은 여전히 하한으로 클램프.
    expect(sunDirectionFromAngles(90, -20, 0).y).toBeCloseTo(0, 12);
  });

  it('기본값은 종전 고정 조명 방향 normalize([0, 1, 0.2])를 재현한다', () => {
    // "기본값이면 필드 생략" 정규화의 float 동등 비교가 성립하는 근거 —
    // 이 일치가 깨지면 lighting 필드 없는 기존 씬의 셰이딩이 변한다.
    const legacy = new Vector3(0, 50, 10).normalize();
    const fromDefaults = sunDirectionFromAngles(
      SCENE_SUN_AZIMUTH_DEFAULT,
      SCENE_SUN_ELEVATION_DEFAULT,
    );
    expect(fromDefaults.x).toBeCloseTo(legacy.x, 15);
    expect(fromDefaults.y).toBeCloseTo(legacy.y, 15);
    expect(fromDefaults.z).toBeCloseTo(legacy.z, 15);
  });
});
