import { describe, expect, it } from 'vitest';
import { VIRTUAL_TAG_KEY_MAX } from '@crane/domain/virtual-tag';
import { getTagKeyError } from '../tag-key-validation';

const taken = ['a', 'b', 'C_1:x'];

describe('getTagKeyError', () => {
  it('빈 값·공백·길이 초과는 invalid-key (경계 정확값은 통과)', () => {
    expect(getTagKeyError('', 'a', taken)).toBe('invalid-key');
    expect(getTagKeyError('   ', 'a', taken)).toBe('invalid-key');
    expect(
      getTagKeyError('k'.repeat(VIRTUAL_TAG_KEY_MAX + 1), 'a', taken),
    ).toBe('invalid-key');
    expect(
      getTagKeyError('k'.repeat(VIRTUAL_TAG_KEY_MAX), 'a', taken),
    ).toBeNull();
  });

  it('자기 키(공백 포함)는 통과, 다른 태그의 키는 duplicate-key', () => {
    expect(getTagKeyError('a', 'a', taken)).toBeNull();
    expect(getTagKeyError('  a ', 'a', taken)).toBeNull();
    expect(getTagKeyError('b', 'a', taken)).toBe('duplicate-key');
    expect(getTagKeyError(' C_1:x ', 'a', taken)).toBe('duplicate-key');
  });

  it('새 키는 null', () => {
    expect(getTagKeyError('new', 'a', taken)).toBeNull();
    expect(getTagKeyError('new', 'a', [])).toBeNull();
  });
});
