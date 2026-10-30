import { describe, expect, it } from 'vitest';
import {
  normalizeTagCode,
  resolveMappingTagKey,
  type TagMapping,
} from '../tag-mapping-types';
import { resolveStatusTagKeys } from '../status-tag-types';

function mapping(overrides: Partial<TagMapping> = {}): TagMapping {
  return {
    id: 'm1',
    target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
    code: 'tl_distance',
    ...overrides,
  };
}

describe('normalizeTagCode', () => {
  it('앞뒤 공백을 자른 코드를 돌려준다', () => {
    expect(normalizeTagCode(' tl_distance ')).toBe('tl_distance');
    expect(normalizeTagCode('mh1_height')).toBe('mh1_height');
  });

  it('비었거나 공백·콜론이 있거나 문자열이 아니면 null', () => {
    expect(normalizeTagCode('')).toBeNull();
    expect(normalizeTagCode('   ')).toBeNull();
    expect(normalizeTagCode('a b')).toBeNull();
    expect(normalizeTagCode('GC_04:gantry')).toBeNull();
    expect(
      normalizeTagCode('4_Crane.4_CR01.4_POS.04_Center_POS_y1:x'),
    ).toBeNull();
    expect(normalizeTagCode(3)).toBeNull();
    expect(normalizeTagCode(null)).toBeNull();
    expect(normalizeTagCode(undefined)).toBeNull();
  });
});

describe('normalizeTagCode — 점', () => {
  it('점은 된다 — 외업 원본 이름을 그대로 코드로 쓴다(앞뒤 공백만 뗀다)', () => {
    expect(normalizeTagCode(' 4_Crane.4_CR01.4_POS.04_Center_POS_y1 ')).toBe(
      '4_Crane.4_CR01.4_POS.04_Center_POS_y1',
    );
    expect(normalizeTagCode('C_171.tl_distance')).toBe('C_171.tl_distance');
  });

  it('점이 든 코드의 키도 첫 점이 크레인 경계다', () => {
    expect(
      resolveMappingTagKey(
        { craneId: 'GC-01' },
        mapping({ code: '4_Crane.4_CR01.4_POS.04_Center_POS_y1' }),
      ),
    ).toBe('GC_01.4_Crane.4_CR01.4_POS.04_Center_POS_y1');
  });
});

describe('resolveMappingTagKey', () => {
  it('모델 craneId 와 코드로 `크레인.코드` 를 만들고 하이픈은 밑줄로', () => {
    expect(resolveMappingTagKey({ craneId: 'C_171' }, mapping())).toBe(
      'C_171.tl_distance',
    );
    expect(resolveMappingTagKey({ craneId: 'GC-04' }, mapping())).toBe(
      'GC_04.tl_distance',
    );
  });

  it('맵핑에 craneId 가 있으면 모델 것보다 우선한다', () => {
    expect(
      resolveMappingTagKey({ craneId: 'C_171' }, mapping({ craneId: 'C_172' })),
    ).toBe('C_172.tl_distance');
    expect(resolveMappingTagKey({}, mapping({ craneId: 'C_172' }))).toBe(
      'C_172.tl_distance',
    );
  });

  it('크레인도 코드도 없으면 undefined — 어느 소스도 값을 주지 않는다', () => {
    expect(resolveMappingTagKey({}, mapping())).toBeUndefined();
    expect(resolveMappingTagKey({ craneId: '' }, mapping())).toBeUndefined();
    expect(
      resolveMappingTagKey({ craneId: 'C_171' }, mapping({ code: '' })),
    ).toBeUndefined();
  });
});

describe('resolveStatusTagKeys', () => {
  it('역할마다 모델 craneId 로 키를 만든다 — 없는 역할은 빠진다', () => {
    expect(
      resolveStatusTagKeys({
        craneId: 'C_171',
        statusTags: {
          controlOn: 'crane_control_on',
          fault: 'crane_system_error',
        },
      }),
    ).toEqual({
      controlOn: 'C_171.crane_control_on',
      fault: 'C_171.crane_system_error',
    });
  });

  it('craneId 나 상태 태그가 없으면 빈 객체', () => {
    expect(
      resolveStatusTagKeys({ statusTags: { fault: 'crane_system_error' } }),
    ).toEqual({});
    expect(resolveStatusTagKeys({ craneId: 'C_171' })).toEqual({});
    expect(
      resolveStatusTagKeys({ craneId: 'C_171', statusTags: { fault: '' } }),
    ).toEqual({});
  });
});
