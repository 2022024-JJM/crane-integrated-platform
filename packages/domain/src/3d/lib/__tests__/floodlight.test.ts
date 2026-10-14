import { describe, expect, it } from 'vitest';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  FLOODLIGHT_ANGLE_DEFAULT,
  FLOODLIGHT_MIN_AIM_DISTANCE,
} from '../../model/floodlight-types';
import {
  floodlightAimDistance,
  floodlightAimPoint,
  floodlightConeOutline,
  floodlightConeRadius,
  floodlightPlacementFromPoints,
  resolveFloodlightAngle,
  resolveFloodlightIntensity,
} from '../floodlight';

describe('floodlightPlacementFromPoints', () => {
  it('첫 점 위로 높이만큼 올린 자리가 기구, 둘째 점까지의 차가 조준 오프셋', () => {
    expect(floodlightPlacementFromPoints([10, 2, -5], [40, 2, 15], 30)).toEqual(
      {
        position: [10, 32, -5],
        aim: [30, -30, 20],
      },
    );
  });

  it('조준점이 없으면(한 번만 찍음) 바로 아래를 비춘다', () => {
    expect(floodlightPlacementFromPoints([1, 0, 1], null, 25)).toEqual({
      position: [1, 25, 1],
      aim: [0, -25, 0],
    });
  });

  it('같은 자리를 다시 찍어도 높이가 있으면 바로 아래 — 유효', () => {
    expect(floodlightPlacementFromPoints([3, 0, 3], [3, 0, 3], 30)).toEqual({
      position: [3, 30, 3],
      aim: [0, -30, 0],
    });
  });

  it('높이 0 에서 같은 자리를 찍으면 조준 거리 0 → null', () => {
    expect(floodlightPlacementFromPoints([3, 0, 3], [3, 0, 3], 0)).toBeNull();
  });

  it('조준 거리 하한 — 정확값은 통과, 그 아래는 null', () => {
    expect(
      floodlightPlacementFromPoints(
        [0, 0, 0],
        null,
        FLOODLIGHT_MIN_AIM_DISTANCE,
      ),
    ).not.toBeNull();
    expect(
      floodlightPlacementFromPoints(
        [0, 0, 0],
        null,
        FLOODLIGHT_MIN_AIM_DISTANCE / 2,
      ),
    ).toBeNull();
  });

  it('비유한 입력은 null', () => {
    expect(
      floodlightPlacementFromPoints([Number.NaN, 0, 0], null, 30),
    ).toBeNull();
    expect(
      floodlightPlacementFromPoints([0, 0, 0], [0, Number.NaN, 0], 30),
    ).toBeNull();
    expect(
      floodlightPlacementFromPoints([0, 0, 0], null, Number.POSITIVE_INFINITY),
    ).toBeNull();
  });

  it('좌표는 소수 3자리로 반올림한다(numRound)', () => {
    const placement = floodlightPlacementFromPoints(
      [0.12345, 0, 0],
      [1.98765, 0, 0],
      30,
    );
    expect(placement?.position[0]).toBe(0.123);
    expect(placement?.aim[0]).toBe(1.865);
  });
});

describe('floodlightAimPoint / floodlightAimDistance', () => {
  const light = {
    position: [10, 30, -20] as Vector3Tuple,
    aim: [0, -30, 40] as Vector3Tuple,
  };

  it('조준점 = 기구 + 오프셋', () => {
    expect(floodlightAimPoint(light)).toEqual([10, 0, 20]);
  });

  it('조준 거리 = 오프셋 길이', () => {
    expect(floodlightAimDistance(light)).toBe(50);
  });
});

describe('resolveFloodlightAngle / resolveFloodlightIntensity', () => {
  it('필드 없음은 기본값, 있으면 그 값', () => {
    expect(resolveFloodlightAngle({})).toBe(FLOODLIGHT_ANGLE_DEFAULT);
    expect(resolveFloodlightAngle({ angle: 20 })).toBe(20);
    expect(resolveFloodlightIntensity({})).toBe(1);
    expect(resolveFloodlightIntensity({ intensity: 2 })).toBe(2);
  });
});

describe('floodlightConeRadius / floodlightConeOutline', () => {
  it('조준점에서의 반경 = 거리 × tan(반각)', () => {
    const light = {
      position: [0, 30, 0] as Vector3Tuple,
      aim: [0, -30, 0] as Vector3Tuple,
      angle: 45,
    };
    expect(floodlightConeRadius(light)).toBeCloseTo(30, 10);
  });

  it('수직 조명의 윤곽 원은 조준점 높이에 놓이고 살은 기구에서 시작한다', () => {
    const light = {
      position: [0, 30, 0] as Vector3Tuple,
      aim: [0, -30, 0] as Vector3Tuple,
      angle: 45,
    };
    const { rim, spokes } = floodlightConeOutline(light, 8);
    // 닫힌 폴리라인 — 첫 점과 끝 점이 같다.
    expect(rim).toHaveLength(9);
    expect(rim[0]).toEqual(rim[8]);
    for (const point of rim) {
      expect(point[1]).toBeCloseTo(0, 10);
      expect(Math.hypot(point[0], point[2])).toBeCloseTo(30, 10);
    }
    expect(spokes).toHaveLength(4);
    for (const spoke of spokes) {
      expect(spoke[0]).toEqual([0, 30, 0]);
      expect(rim).toContainEqual(spoke[1]);
    }
  });

  it('기울어진 조명의 윤곽 원은 조준 축에 수직이다', () => {
    const light = {
      position: [0, 30, 0] as Vector3Tuple,
      aim: [40, -30, 0] as Vector3Tuple,
      angle: 30,
    };
    const { rim } = floodlightConeOutline(light, 16);
    const center = floodlightAimPoint(light);
    const axis = [40 / 50, -30 / 50, 0];
    for (const point of rim) {
      const d = [
        point[0] - center[0],
        point[1] - center[1],
        point[2] - center[2],
      ];
      expect(d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2]).toBeCloseTo(
        0,
        9,
      );
      expect(Math.hypot(...d)).toBeCloseTo(floodlightConeRadius(light), 9);
    }
  });

  it('분할 수는 최소 4 이고 정수로 내린다', () => {
    const light = {
      position: [0, 30, 0] as Vector3Tuple,
      aim: [0, -30, 0] as Vector3Tuple,
    };
    expect(floodlightConeOutline(light, 1).rim).toHaveLength(5);
    expect(floodlightConeOutline(light, 6.9).rim).toHaveLength(7);
  });
});
