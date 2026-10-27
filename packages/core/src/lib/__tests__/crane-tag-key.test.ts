import { describe, expect, it } from 'vitest';
import {
  buildCraneTagKey,
  normalizeCraneKey,
  normalizeLegacyCraneTagKey,
  parseCraneTagKey,
} from '../crane-tag-key';

describe('buildCraneTagKey / normalizeCraneKey', () => {
  it('`${craneId}.${tagCode}` 로 만들고 하이픈은 밑줄로 바꾼다', () => {
    expect(buildCraneTagKey('C_171', 'tl_distance')).toBe('C_171.tl_distance');
    expect(buildCraneTagKey('GC-04', 'gantry_position')).toBe(
      'GC_04.gantry_position',
    );
    expect(normalizeCraneKey('a-b-c')).toBe('a_b_c');
  });
});

describe('parseCraneTagKey', () => {
  it('첫 점 기준으로 나눈다 — 코드에 점이 더 있어도 그대로 둔다', () => {
    expect(parseCraneTagKey('C_171.tl_distance')).toEqual({
      craneKey: 'C_171',
      tagCode: 'tl_distance',
    });
    expect(parseCraneTagKey('A.b.c')).toEqual({
      craneKey: 'A',
      tagCode: 'b.c',
    });
  });

  it('빌드 → 파스 왕복이 성립한다', () => {
    const key = buildCraneTagKey('GC-04', 'trolley_position_2');
    expect(parseCraneTagKey(key)).toEqual({
      craneKey: 'GC_04',
      tagCode: 'trolley_position_2',
    });
  });

  it('점이 없거나 어느 쪽이 비면 null — 콜론 표기(가상 태그·옛 키)도 null', () => {
    expect(parseCraneTagKey('nodot')).toBeNull();
    expect(parseCraneTagKey('C_171:tl_distance')).toBeNull();
    expect(parseCraneTagKey('.code')).toBeNull();
    expect(parseCraneTagKey('C_1.')).toBeNull();
    expect(parseCraneTagKey('')).toBeNull();
  });
});

describe('normalizeLegacyCraneTagKey', () => {
  it('첫 콜론만 점으로 바꾼다', () => {
    expect(normalizeLegacyCraneTagKey('C_171:tl_distance')).toBe(
      'C_171.tl_distance',
    );
    expect(normalizeLegacyCraneTagKey('A:b:c')).toBe('A.b:c');
  });

  it('이미 점이 있거나 콜론이 없거나 콜론이 끝·처음이면 그대로', () => {
    expect(normalizeLegacyCraneTagKey('C_171.tl_distance')).toBe(
      'C_171.tl_distance',
    );
    expect(normalizeLegacyCraneTagKey('plain')).toBe('plain');
    expect(normalizeLegacyCraneTagKey(':x')).toBe(':x');
    expect(normalizeLegacyCraneTagKey('x:')).toBe('x:');
  });
});
