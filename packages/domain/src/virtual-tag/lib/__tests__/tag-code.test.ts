import { describe, expect, it } from 'vitest';
import { normalizeVirtualTagCode } from '../tag-code';
import { VIRTUAL_TAG_CODE_MAX } from '../../model/types';

describe('normalizeVirtualTagCode', () => {
  it('trim 한 코드를 돌려준다 — 길이 경계 정확값은 통과', () => {
    expect(normalizeVirtualTagCode(' tl_distance ')).toBe('tl_distance');
    expect(
      normalizeVirtualTagCode('c'.repeat(VIRTUAL_TAG_CODE_MAX)),
    ).toHaveLength(VIRTUAL_TAG_CODE_MAX);
  });

  it('비었거나 길거나 공백·콜론이 있거나 문자열이 아니면 null', () => {
    expect(normalizeVirtualTagCode('')).toBeNull();
    expect(normalizeVirtualTagCode('  ')).toBeNull();
    expect(
      normalizeVirtualTagCode('c'.repeat(VIRTUAL_TAG_CODE_MAX + 1)),
    ).toBeNull();
    expect(normalizeVirtualTagCode('a b')).toBeNull();
    expect(normalizeVirtualTagCode('a:b')).toBeNull();
    expect(normalizeVirtualTagCode(1)).toBeNull();
    expect(normalizeVirtualTagCode(null)).toBeNull();
  });

  it('점은 된다 — 외업 원본 이름 중 가장 긴 것(49자)도 들어간다', () => {
    const longest = '4_Crane.4_CR20.0_state.05_Local_PLC_comm_fault_17';
    expect(longest).toHaveLength(49);
    expect(normalizeVirtualTagCode(longest)).toBe(longest);
    expect(normalizeVirtualTagCode('c'.repeat(VIRTUAL_TAG_CODE_MAX))).toBe(
      'c'.repeat(VIRTUAL_TAG_CODE_MAX),
    );
  });
});
