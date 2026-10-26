import { describe, expect, it } from 'vitest';
import {
  buildVirtualTagKey,
  normalizeVirtualEquipmentId,
  normalizeVirtualEquipmentKey,
  normalizeVirtualTagCode,
  parseVirtualTagKey,
} from '../virtual-tag-key';
import {
  VIRTUAL_EQUIPMENT_ID_MAX,
  VIRTUAL_TAG_CODE_MAX,
} from '../../model/types';

describe('normalizeVirtualEquipmentId / normalizeVirtualTagCode', () => {
  it('trim 하고, 빈 값·길이 초과·공백·콜론·비문자열은 null', () => {
    expect(normalizeVirtualEquipmentId(' GC-04 ')).toBe('GC-04');
    expect(normalizeVirtualEquipmentId('   ')).toBeNull();
    expect(normalizeVirtualEquipmentId('GC 04')).toBeNull();
    expect(normalizeVirtualEquipmentId('GC:04')).toBeNull();
    expect(normalizeVirtualEquipmentId(12)).toBeNull();
    expect(
      normalizeVirtualEquipmentId('x'.repeat(VIRTUAL_EQUIPMENT_ID_MAX)),
    ).toHaveLength(VIRTUAL_EQUIPMENT_ID_MAX);
    expect(
      normalizeVirtualEquipmentId('x'.repeat(VIRTUAL_EQUIPMENT_ID_MAX + 1)),
    ).toBeNull();

    expect(normalizeVirtualTagCode(' gantry_position ')).toBe(
      'gantry_position',
    );
    expect(normalizeVirtualTagCode('a\tb')).toBeNull();
    expect(normalizeVirtualTagCode('a:b')).toBeNull();
    expect(normalizeVirtualTagCode('')).toBeNull();
    expect(
      normalizeVirtualTagCode('c'.repeat(VIRTUAL_TAG_CODE_MAX)),
    ).toHaveLength(VIRTUAL_TAG_CODE_MAX);
    expect(
      normalizeVirtualTagCode('c'.repeat(VIRTUAL_TAG_CODE_MAX + 1)),
    ).toBeNull();
  });
});

describe('키 조립·분해', () => {
  it('장비키는 하이픈을 밑줄로 — 실시간 normalizeCraneKey 와 같은 규칙', () => {
    expect(normalizeVirtualEquipmentKey('GC-04')).toBe('GC_04');
    expect(normalizeVirtualEquipmentKey(' A-B-C ')).toBe('A_B_C');
    expect(normalizeVirtualEquipmentKey('C_171')).toBe('C_171');
  });

  it('buildVirtualTagKey 는 콜론으로 잇는다', () => {
    expect(buildVirtualTagKey('GC-04', 'gantry_position')).toBe(
      'GC_04:gantry_position',
    );
    expect(buildVirtualTagKey('GC_04', 'x')).toBe('GC_04:x');
  });

  it('parseVirtualTagKey 는 첫 콜론에서 나누고, 실시간 표기·빈 쪽은 null', () => {
    expect(parseVirtualTagKey('GC_04:gantry_position')).toEqual({
      equipmentKey: 'GC_04',
      code: 'gantry_position',
    });
    expect(parseVirtualTagKey('a:b:c')).toEqual({
      equipmentKey: 'a',
      code: 'b:c',
    });
    expect(parseVirtualTagKey(':x')).toBeNull();
    expect(parseVirtualTagKey('x:')).toBeNull();
    expect(parseVirtualTagKey('C_171.tl_distance')).toBeNull();
    expect(parseVirtualTagKey('')).toBeNull();
  });

  it('조립 → 분해 왕복이 장비키·코드를 보존한다', () => {
    const key = buildVirtualTagKey('LLC-002', 'luff_angle');
    expect(parseVirtualTagKey(key)).toEqual({
      equipmentKey: 'LLC_002',
      code: 'luff_angle',
    });
  });
});
