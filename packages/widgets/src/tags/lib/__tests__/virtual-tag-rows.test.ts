import { describe, expect, it } from 'vitest';
import type {
  VirtualEquipment,
  VirtualTagDefinition,
} from '@crane/domain/virtual-tag';
import {
  collectVirtualBays,
  filterVirtualEquipments,
  filterVirtualTags,
  formatVirtualValue,
  isBoolOn,
  nextTagCode,
  sliderStep,
  valuePercent,
} from '../virtual-tag-rows';

function tag(
  code: string,
  patch: Partial<VirtualTagDefinition> = {},
): VirtualTagDefinition {
  return {
    id: `t-${code}`,
    code,
    name: '',
    dataType: 'number',
    min: 0,
    max: 10,
    initial: 0,
    pattern: { kind: 'manual' },
    ...patch,
  };
}

function equipment(
  craneId: string,
  patch: Partial<VirtualEquipment> = {},
): VirtualEquipment {
  return {
    id: `e-${craneId}`,
    craneId,
    enabled: true,
    tags: [],
    ...patch,
  };
}

const equipments = [
  equipment('GC-04', { bay: 'B2' }),
  equipment('C_171', { bay: 'B1' }),
  equipment('C_172', { bay: 'B1' }),
  equipment('LLC_002'),
];

describe('collectVirtualBays / filterVirtualEquipments', () => {
  it('구역이 있는 장비만 세어 이름순으로', () => {
    expect(collectVirtualBays(equipments)).toEqual([
      { bay: 'B1', count: 2 },
      { bay: 'B2', count: 1 },
    ]);
    expect(collectVirtualBays([])).toEqual([]);
  });

  it('구역 칩과 검색어(ID·구역, 대소문자·공백 무시)로 거르고 순서를 지킨다', () => {
    expect(
      filterVirtualEquipments(equipments, 'all', '').map((e) => e.craneId),
    ).toEqual(['GC-04', 'C_171', 'C_172', 'LLC_002']);
    expect(
      filterVirtualEquipments(equipments, 'B1', '').map((e) => e.craneId),
    ).toEqual(['C_171', 'C_172']);
    expect(
      filterVirtualEquipments(equipments, 'all', ' gc ').map((e) => e.craneId),
    ).toEqual(['GC-04']);
    expect(
      filterVirtualEquipments(equipments, 'all', 'c_17').map((e) => e.craneId),
    ).toEqual(['C_171', 'C_172']);
    expect(
      filterVirtualEquipments(equipments, 'B1', 'b1').map((e) => e.craneId),
    ).toEqual(['C_171', 'C_172']);
    expect(filterVirtualEquipments(equipments, 'B9', '')).toEqual([]);
    expect(filterVirtualEquipments(equipments, 'all', 'zzz')).toEqual([]);
  });
});

describe('filterVirtualTags', () => {
  const tags = [tag('gantry', { name: '주행' }), tag('trolley'), tag('power')];

  it('코드·이름 부분 일치(대소문자·공백 무시), 빈 검색어는 복사본 전부', () => {
    const out = filterVirtualTags(tags, '');
    expect(out).toEqual(tags);
    expect(out).not.toBe(tags);
    expect(filterVirtualTags(tags, '  ')).toEqual(tags);
    expect(filterVirtualTags(tags, 'TROL').map((t) => t.code)).toEqual([
      'trolley',
    ]);
    expect(filterVirtualTags(tags, ' 주행 ').map((t) => t.code)).toEqual([
      'gantry',
    ]);
    expect(filterVirtualTags(tags, 'o').map((t) => t.code)).toEqual([
      'trolley',
      'power',
    ]);
    expect(filterVirtualTags(tags, 'zzz')).toEqual([]);
    expect(filterVirtualTags([], 'a')).toEqual([]);
  });
});

describe('값 표기 보조', () => {
  it('formatVirtualValue — 소수 셋째 자리, 꼬리 0 제거, 없음·NaN 은 대시, 불리언은 0/1', () => {
    expect(formatVirtualValue(1.23456)).toBe('1.235');
    expect(formatVirtualValue(2.5)).toBe('2.5');
    expect(formatVirtualValue(0)).toBe('0');
    expect(formatVirtualValue(undefined)).toBe('—');
    expect(formatVirtualValue(NaN)).toBe('—');
    expect(formatVirtualValue(0.7, 'bool')).toBe('1');
    expect(formatVirtualValue(0.4, 'bool')).toBe('0');
  });

  it('valuePercent — 범위 안 위치를 0~100 으로 클램프, 범위·값이 없으면 0', () => {
    expect(valuePercent(5, 0, 10)).toBe(50);
    expect(valuePercent(-5, 0, 10)).toBe(0);
    expect(valuePercent(15, 0, 10)).toBe(100);
    expect(valuePercent(undefined, 0, 10)).toBe(0);
    expect(valuePercent(5, 10, 10)).toBe(0);
  });

  it('sliderStep·isBoolOn·nextTagCode', () => {
    expect(sliderStep(0, 100)).toBe(0.5);
    expect(sliderStep(5, 5)).toBe(1);
    expect(isBoolOn(1)).toBe(true);
    expect(isBoolOn(0.5)).toBe(true);
    expect(isBoolOn(0.49)).toBe(false);
    expect(isBoolOn(undefined)).toBe(false);
    expect(nextTagCode('tag', [])).toBe('tag');
    expect(nextTagCode('tag', ['tag'])).toBe('tag_2');
    expect(nextTagCode('tag', ['tag', 'tag_2'])).toBe('tag_3');
  });
});
