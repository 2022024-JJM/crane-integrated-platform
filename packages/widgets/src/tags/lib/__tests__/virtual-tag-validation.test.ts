import { describe, expect, it } from 'vitest';
import {
  VIRTUAL_EQUIPMENT_ID_MAX,
  VIRTUAL_TAG_CODE_MAX,
} from '@crane/domain/virtual-tag';
import {
  getEquipmentIdError,
  getTagCodeError,
} from '../virtual-tag-validation';

describe('getEquipmentIdError', () => {
  const taken = ['GC-04', 'C_171'];

  it('빈 값·공백·콜론·길이 초과는 invalid-id (경계 정확값은 통과)', () => {
    expect(getEquipmentIdError('', null, taken)).toBe('invalid-id');
    expect(getEquipmentIdError('   ', null, taken)).toBe('invalid-id');
    expect(getEquipmentIdError('GC 05', null, taken)).toBe('invalid-id');
    expect(getEquipmentIdError('GC:05', null, taken)).toBe('invalid-id');
    expect(
      getEquipmentIdError(
        'x'.repeat(VIRTUAL_EQUIPMENT_ID_MAX + 1),
        null,
        taken,
      ),
    ).toBe('invalid-id');
    expect(
      getEquipmentIdError('x'.repeat(VIRTUAL_EQUIPMENT_ID_MAX), null, taken),
    ).toBeNull();
  });

  it('정규화 키가 같은 다른 장비는 duplicate-id, 자기 ID(표기 달라도)는 통과', () => {
    expect(getEquipmentIdError('GC_04', null, taken)).toBe('duplicate-id');
    expect(getEquipmentIdError(' GC-04 ', null, taken)).toBe('duplicate-id');
    expect(getEquipmentIdError('GC_04', 'GC-04', taken)).toBeNull();
    expect(getEquipmentIdError('C_171', 'C-171', taken)).toBeNull();
    expect(getEquipmentIdError('C_172', 'C_171', taken)).toBeNull();
    expect(getEquipmentIdError('new', null, [])).toBeNull();
  });
});

describe('getTagCodeError', () => {
  const taken = ['a', 'b', 'gantry_position'];

  it('빈 값·공백·콜론·길이 초과는 invalid-code (경계 정확값은 통과)', () => {
    expect(getTagCodeError('', 'a', taken)).toBe('invalid-code');
    expect(getTagCodeError('   ', 'a', taken)).toBe('invalid-code');
    expect(getTagCodeError('a b', 'a', taken)).toBe('invalid-code');
    expect(getTagCodeError('a:b', 'a', taken)).toBe('invalid-code');
    expect(
      getTagCodeError('k'.repeat(VIRTUAL_TAG_CODE_MAX + 1), 'a', taken),
    ).toBe('invalid-code');
    expect(getTagCodeError('k'.repeat(VIRTUAL_TAG_CODE_MAX), 'a', taken)).toBe(
      null,
    );
  });

  it('자기 코드(공백 포함)는 통과, 다른 태그의 코드는 duplicate-code, 새 코드는 null', () => {
    expect(getTagCodeError('a', 'a', taken)).toBeNull();
    expect(getTagCodeError('  a ', 'a', taken)).toBeNull();
    expect(getTagCodeError('b', 'a', taken)).toBe('duplicate-code');
    expect(getTagCodeError(' gantry_position ', null, taken)).toBe(
      'duplicate-code',
    );
    expect(getTagCodeError('new', 'a', taken)).toBeNull();
    expect(getTagCodeError('new', null, [])).toBeNull();
  });
});
