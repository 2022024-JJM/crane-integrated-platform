import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ZONE_COLOR,
  normalizeZoneColor,
  sanitizeModelZones,
  sanitizeZoneOffset,
} from '../sanitize-model-zones';

function zone(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'z1',
    name: '작업 반경',
    color: '#38bdf8',
    radius: 10,
    ...overrides,
  };
}

describe('sanitizeModelZones — 컨테이너', () => {
  it('배열이 아니면 undefined (undefined·null·객체·문자열)', () => {
    expect(sanitizeModelZones(undefined)).toBeUndefined();
    expect(sanitizeModelZones(null)).toBeUndefined();
    expect(sanitizeModelZones({ id: 'z1' })).toBeUndefined();
    expect(sanitizeModelZones('zones')).toBeUndefined();
  });

  it('빈 배열·전부 무효인 배열은 undefined 로 필드를 생략한다', () => {
    expect(sanitizeModelZones([])).toBeUndefined();
    expect(sanitizeModelZones([null, 3, 'x', {}])).toBeUndefined();
  });

  it('정상 항목은 필드를 보존하고 알 수 없는 필드는 버린다', () => {
    expect(
      sanitizeModelZones([zone({ offset: [1, -2], extra: true })]),
    ).toEqual([
      {
        id: 'z1',
        name: '작업 반경',
        color: '#38bdf8',
        radius: 10,
        offset: [1, -2],
      },
    ]);
  });
});

describe('sanitizeModelZones — id', () => {
  it('id 가 없거나 빈 문자열이면 항목을 버린다', () => {
    expect(
      sanitizeModelZones([zone({ id: '' }), zone({ id: 1 })]),
    ).toBeUndefined();
    const { id: _id, ...noId } = zone();
    void _id;
    expect(sanitizeModelZones([noId])).toBeUndefined();
  });

  it('중복 id 는 첫 항목만 남긴다', () => {
    const out = sanitizeModelZones([
      zone({ radius: 5 }),
      zone({ radius: 50, name: 'dup' }),
      zone({ id: 'z2', radius: 7 }),
    ]);
    expect(out?.map((z) => [z.id, z.radius])).toEqual([
      ['z1', 5],
      ['z2', 7],
    ]);
  });
});

describe('sanitizeModelZones — radius', () => {
  it('0·음수·NaN·Infinity·문자열 반경은 항목을 버린다', () => {
    expect(
      sanitizeModelZones([
        zone({ radius: 0 }),
        zone({ id: 'a', radius: -1 }),
        zone({ id: 'b', radius: Number.NaN }),
        zone({ id: 'c', radius: Number.POSITIVE_INFINITY }),
        zone({ id: 'd', radius: '10' }),
      ]),
    ).toBeUndefined();
  });

  it('아주 작은 양수도 통과한다 (상한 없음)', () => {
    expect(sanitizeModelZones([zone({ radius: 0.001 })])?.[0].radius).toBe(
      0.001,
    );
    expect(sanitizeModelZones([zone({ radius: 1e6 })])?.[0].radius).toBe(1e6);
  });
});

describe('sanitizeModelZones — color', () => {
  it('대문자 hex 는 소문자로 정규화한다', () => {
    expect(sanitizeModelZones([zone({ color: '#38BDF8' })])?.[0].color).toBe(
      '#38bdf8',
    );
  });

  it('#fff·이름·rgb()·비문자열은 기본색으로 되돌리되 항목은 살린다', () => {
    for (const bad of [
      '#fff',
      'red',
      'rgb(1,2,3)',
      '38bdf8',
      7,
      null,
      undefined,
    ]) {
      const out = sanitizeModelZones([zone({ color: bad })]);
      expect(out).toHaveLength(1);
      expect(out?.[0].color).toBe(DEFAULT_ZONE_COLOR);
    }
  });

  it('normalizeZoneColor 는 유효하면 소문자, 아니면 null', () => {
    expect(normalizeZoneColor('#ABCDEF')).toBe('#abcdef');
    expect(normalizeZoneColor('#abcdeg')).toBeNull();
    expect(normalizeZoneColor(3)).toBeNull();
  });
});

describe('sanitizeModelZones — name', () => {
  it('문자열이 아니면 빈 문자열, 빈 문자열은 그대로', () => {
    expect(sanitizeModelZones([zone({ name: 3 })])?.[0].name).toBe('');
    expect(sanitizeModelZones([zone({ name: '' })])?.[0].name).toBe('');
    const { name: _n, ...noName } = zone();
    void _n;
    expect(sanitizeModelZones([noName])?.[0].name).toBe('');
  });
});

describe('sanitizeZoneOffset / offset', () => {
  it('길이 2 유한수만 받고 [0,0] 은 생략한다', () => {
    expect(sanitizeZoneOffset([1, 2])).toEqual([1, 2]);
    expect(sanitizeZoneOffset([0, 0])).toBeUndefined();
    expect(sanitizeZoneOffset([-0, 0])).toBeUndefined();
    expect(sanitizeZoneOffset([1])).toBeUndefined();
    expect(sanitizeZoneOffset([1, 2, 3])).toBeUndefined();
    expect(sanitizeZoneOffset([1, Number.NaN])).toBeUndefined();
    expect(sanitizeZoneOffset(['1', 2])).toBeUndefined();
    expect(sanitizeZoneOffset(undefined)).toBeUndefined();
  });

  it('무효 오프셋은 필드만 빠지고 영역은 남는다', () => {
    const out = sanitizeModelZones([zone({ offset: [Number.NaN, 1] })]);
    expect(out).toHaveLength(1);
    expect(out?.[0]).not.toHaveProperty('offset');
  });
});

describe('level', () => {
  it("'stop' 만 기록하고 그 외는 생략한다", () => {
    const base = { id: 'z', name: '', color: '#38bdf8', radius: 1 };
    expect(sanitizeModelZones([{ ...base, level: 'stop' }])?.[0].level).toBe(
      'stop',
    );
    expect(
      sanitizeModelZones([{ ...base, level: 'warn' }])?.[0],
    ).not.toHaveProperty('level');
    expect(
      sanitizeModelZones([{ ...base, level: 'STOP' }])?.[0],
    ).not.toHaveProperty('level');
    expect(sanitizeModelZones([base])?.[0]).not.toHaveProperty('level');
  });
});
