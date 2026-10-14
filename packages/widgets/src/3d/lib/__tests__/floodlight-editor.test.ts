import { describe, expect, it } from 'vitest';
import {
  FLOODLIGHT_ANGLE_DEFAULT,
  FLOODLIGHT_ANGLE_MAX,
  FLOODLIGHT_ANGLE_MIN,
  FLOODLIGHT_INTENSITY_DEFAULT,
  FLOODLIGHT_INTENSITY_MAX,
  FLOODLIGHT_INTENSITY_MIN,
  type SavedFloodlightInfo,
} from '@crane/domain/3d';
import {
  floodlightHeightUnits,
  floodlightUnitsToMeters,
  withFloodlightAimAxisMeters,
  withFloodlightAimPoint,
  withFloodlightAngle,
  withFloodlightHeightMeters,
  withFloodlightIntensity,
} from '../floodlight-editor';

function light(
  overrides: Partial<SavedFloodlightInfo> = {},
): SavedFloodlightInfo {
  return {
    id: 'f1',
    name: '조명 1',
    position: [10, 30, -20],
    aim: [20, -30, 10],
    ...overrides,
  };
}

describe('floodlightUnitsToMeters / floodlightHeightUnits', () => {
  it('unit × m/unit, 비유한·0 이하 축척은 1', () => {
    expect(floodlightUnitsToMeters(3, 11.7)).toBe(35.1);
    expect(floodlightUnitsToMeters(3, 0)).toBe(3);
    expect(floodlightUnitsToMeters(3, Number.NaN)).toBe(3);
  });

  it('높이 = −aim.y', () => {
    expect(floodlightHeightUnits(light())).toBe(30);
  });
});

describe('withFloodlightHeightMeters', () => {
  it('기구만 오르내리고 조준점은 그대로다', () => {
    const next = withFloodlightHeightMeters(light(), 40, 1);
    expect(next.position).toEqual([10, 40, -20]);
    expect(next.aim).toEqual([20, -40, 10]);
  });

  it('축척을 환산한다 (m 입력 → unit 저장)', () => {
    const next = withFloodlightHeightMeters(light(), 23.4, 11.7);
    expect(next.aim[1]).toBe(-2);
    expect(next.position[1]).toBe(2);
  });

  it('같은 높이·0 이하·비유한은 같은 참조', () => {
    const base = light();
    expect(withFloodlightHeightMeters(base, 30, 1)).toBe(base);
    expect(withFloodlightHeightMeters(base, 0, 1)).toBe(base);
    expect(withFloodlightHeightMeters(base, -5, 1)).toBe(base);
    expect(withFloodlightHeightMeters(base, Number.NaN, 1)).toBe(base);
  });
});

describe('withFloodlightAimAxisMeters', () => {
  it('조준점의 월드 X·Z 를 바꾸면 오프셋만 바뀐다', () => {
    const nextX = withFloodlightAimAxisMeters(light(), 'x', 50, 1);
    expect(nextX.aim).toEqual([40, -30, 10]);
    expect(nextX.position).toEqual([10, 30, -20]);
    const nextZ = withFloodlightAimAxisMeters(light(), 'z', 0, 1);
    expect(nextZ.aim).toEqual([20, -30, 20]);
  });

  it('같은 값·비유한은 같은 참조', () => {
    const base = light();
    // 현재 조준점 X = 30 m.
    expect(withFloodlightAimAxisMeters(base, 'x', 30, 1)).toBe(base);
    expect(withFloodlightAimAxisMeters(base, 'z', Number.NaN, 1)).toBe(base);
  });

  it('조준 거리가 하한 아래로 떨어지는 입력은 무시한다', () => {
    const flat = light({ aim: [0.4, 0, 0] });
    expect(withFloodlightAimAxisMeters(flat, 'x', 10.1, 1)).toBe(flat);
  });
});

describe('withFloodlightAimPoint', () => {
  it('바닥 점을 기구 기준 오프셋으로 저장한다', () => {
    const next = withFloodlightAimPoint(light(), [0, 1, 0]);
    expect(next.aim).toEqual([-10, -29, 20]);
  });

  it('같은 점·기구 자리(거리 0)·비유한은 같은 참조', () => {
    const base = light();
    expect(withFloodlightAimPoint(base, [30, 0, -10])).toBe(base);
    expect(withFloodlightAimPoint(base, [10, 30, -20])).toBe(base);
    expect(withFloodlightAimPoint(base, [Number.NaN, 0, 0])).toBe(base);
  });
});

describe('withFloodlightAngle', () => {
  it('범위 안 값은 저장, 기본값이면 필드를 뗀다', () => {
    expect(withFloodlightAngle(light(), 50).angle).toBe(50);
    expect(
      withFloodlightAngle(light({ angle: 50 }), FLOODLIGHT_ANGLE_DEFAULT),
    ).not.toHaveProperty('angle');
  });

  it('경계 — 정확값은 그대로, 밖은 클램프', () => {
    expect(withFloodlightAngle(light(), FLOODLIGHT_ANGLE_MIN).angle).toBe(
      FLOODLIGHT_ANGLE_MIN,
    );
    expect(withFloodlightAngle(light(), FLOODLIGHT_ANGLE_MIN - 1).angle).toBe(
      FLOODLIGHT_ANGLE_MIN,
    );
    expect(withFloodlightAngle(light(), FLOODLIGHT_ANGLE_MAX + 1).angle).toBe(
      FLOODLIGHT_ANGLE_MAX,
    );
  });

  it('같은 값·비유한은 같은 참조', () => {
    const base = light({ angle: 50 });
    expect(withFloodlightAngle(base, 50)).toBe(base);
    expect(withFloodlightAngle(light(), FLOODLIGHT_ANGLE_DEFAULT)).toBe;
    const plain = light();
    expect(withFloodlightAngle(plain, FLOODLIGHT_ANGLE_DEFAULT)).toBe(plain);
    expect(withFloodlightAngle(plain, Number.NaN)).toBe(plain);
  });
});

describe('withFloodlightIntensity', () => {
  it('범위 안 값은 소수 2자리로 저장, 기본값이면 필드를 뗀다', () => {
    expect(withFloodlightIntensity(light(), 1.234).intensity).toBe(1.23);
    expect(
      withFloodlightIntensity(
        light({ intensity: 2 }),
        FLOODLIGHT_INTENSITY_DEFAULT,
      ),
    ).not.toHaveProperty('intensity');
  });

  it('경계 — 정확값은 그대로, 밖은 클램프', () => {
    expect(
      withFloodlightIntensity(light(), FLOODLIGHT_INTENSITY_MIN).intensity,
    ).toBe(FLOODLIGHT_INTENSITY_MIN);
    expect(withFloodlightIntensity(light(), 0).intensity).toBe(
      FLOODLIGHT_INTENSITY_MIN,
    );
    expect(withFloodlightIntensity(light(), 100).intensity).toBe(
      FLOODLIGHT_INTENSITY_MAX,
    );
  });

  it('같은 값·비유한은 같은 참조', () => {
    const base = light({ intensity: 2 });
    expect(withFloodlightIntensity(base, 2)).toBe(base);
    const plain = light();
    expect(withFloodlightIntensity(plain, FLOODLIGHT_INTENSITY_DEFAULT)).toBe(
      plain,
    );
    expect(withFloodlightIntensity(plain, Number.NaN)).toBe(plain);
  });
});
