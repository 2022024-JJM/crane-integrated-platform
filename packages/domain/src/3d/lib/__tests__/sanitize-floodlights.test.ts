import { describe, expect, it } from 'vitest';
import {
  FLOODLIGHT_ANGLE_DEFAULT,
  FLOODLIGHT_ANGLE_MAX,
  FLOODLIGHT_ANGLE_MIN,
  FLOODLIGHT_INTENSITY_DEFAULT,
  FLOODLIGHT_INTENSITY_MAX,
  FLOODLIGHT_INTENSITY_MIN,
  FLOODLIGHT_MIN_AIM_DISTANCE,
} from '../../model/floodlight-types';
import { sanitizeFloodlightFields } from '../sanitize-floodlights';

function light(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'f1',
    name: '조명 1',
    position: [10, 30, -20],
    aim: [5, -30, 8],
    ...overrides,
  };
}

describe('sanitizeFloodlightFields — 컨테이너', () => {
  it('객체가 아니면 null (undefined·null·배열·문자열·숫자)', () => {
    expect(sanitizeFloodlightFields(undefined)).toBeNull();
    expect(sanitizeFloodlightFields(null)).toBeNull();
    expect(sanitizeFloodlightFields([light()])).toBeNull();
    expect(sanitizeFloodlightFields('light')).toBeNull();
    expect(sanitizeFloodlightFields(3)).toBeNull();
  });

  it('정상 항목은 필드를 보존하고 id·알 수 없는 필드·회전·크기는 싣지 않는다', () => {
    expect(
      sanitizeFloodlightFields(
        light({
          extra: true,
          rotation: [0, 90, 0],
          scale: [2, 2, 2],
          color: '#ffffff',
        }),
      ),
    ).toEqual({
      name: '조명 1',
      position: [10, 30, -20],
      aim: [5, -30, 8],
    });
  });

  it('이름이 문자열이 아니면 빈 문자열', () => {
    expect(sanitizeFloodlightFields(light({ name: 3 }))?.name).toBe('');
    const { name: _name, ...noName } = light();
    void _name;
    expect(sanitizeFloodlightFields(noName)?.name).toBe('');
  });
});

describe('sanitizeFloodlightFields — 비출 수 없는 항목은 버린다', () => {
  it('위치·조준이 깨졌으면 null (누락·길이 다름·NaN·문자열)', () => {
    const { position: _position, ...noPosition } = light();
    void _position;
    expect(sanitizeFloodlightFields(noPosition)).toBeNull();
    const { aim: _aim, ...noAim } = light();
    void _aim;
    expect(sanitizeFloodlightFields(noAim)).toBeNull();
    expect(sanitizeFloodlightFields(light({ position: [1, 2] }))).toBeNull();
    expect(
      sanitizeFloodlightFields(light({ aim: [0, Number.NaN, 0] })),
    ).toBeNull();
    expect(
      sanitizeFloodlightFields(light({ position: ['1', 2, 3] })),
    ).toBeNull();
    expect(
      sanitizeFloodlightFields(
        light({ aim: [0, Number.NEGATIVE_INFINITY, 0] }),
      ),
    ).toBeNull();
  });

  it('조준 거리 — 하한 정확값은 통과, 그 아래는 null', () => {
    expect(
      sanitizeFloodlightFields(
        light({ aim: [0, -FLOODLIGHT_MIN_AIM_DISTANCE, 0] }),
      ),
    ).not.toBeNull();
    expect(
      sanitizeFloodlightFields(
        light({ aim: [0, -(FLOODLIGHT_MIN_AIM_DISTANCE - 0.01), 0] }),
      ),
    ).toBeNull();
    expect(sanitizeFloodlightFields(light({ aim: [0, 0, 0] }))).toBeNull();
  });
});

describe('sanitizeFloodlightFields — 각도·세기는 기본값으로 되돌린다', () => {
  it('기본값은 싣지 않는다', () => {
    const out = sanitizeFloodlightFields(
      light({
        angle: FLOODLIGHT_ANGLE_DEFAULT,
        intensity: FLOODLIGHT_INTENSITY_DEFAULT,
      }),
    );
    expect(out).not.toHaveProperty('angle');
    expect(out).not.toHaveProperty('intensity');
  });

  it('범위 안 값은 보존하고 경계 밖은 클램프한다', () => {
    expect(sanitizeFloodlightFields(light({ angle: 50 }))?.angle).toBe(50);
    expect(sanitizeFloodlightFields(light({ angle: 0 }))?.angle).toBe(
      FLOODLIGHT_ANGLE_MIN,
    );
    expect(sanitizeFloodlightFields(light({ angle: 179 }))?.angle).toBe(
      FLOODLIGHT_ANGLE_MAX,
    );
    expect(sanitizeFloodlightFields(light({ intensity: 2.5 }))?.intensity).toBe(
      2.5,
    );
    expect(sanitizeFloodlightFields(light({ intensity: 0 }))?.intensity).toBe(
      FLOODLIGHT_INTENSITY_MIN,
    );
    expect(sanitizeFloodlightFields(light({ intensity: 99 }))?.intensity).toBe(
      FLOODLIGHT_INTENSITY_MAX,
    );
  });

  it('타입 오염(문자열·NaN)은 기본값 — 조명은 남는다', () => {
    const out = sanitizeFloodlightFields(
      light({ angle: '35', intensity: Number.NaN }),
    );
    expect(out).not.toBeNull();
    expect(out).not.toHaveProperty('angle');
    expect(out).not.toHaveProperty('intensity');
  });
});

describe('sanitizeFloodlightFields — 잠금', () => {
  it('true 만 싣고 그 밖(false·문자열)은 뗀다', () => {
    expect(sanitizeFloodlightFields(light({ locked: true }))?.locked).toBe(
      true,
    );
    expect(
      sanitizeFloodlightFields(light({ locked: false })),
    ).not.toHaveProperty('locked');
    expect(
      sanitizeFloodlightFields(light({ locked: 'yes' })),
    ).not.toHaveProperty('locked');
  });
});
