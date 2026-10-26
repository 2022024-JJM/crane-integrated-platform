import { describe, expect, it } from 'vitest';
import type {
  VirtualEquipment,
  VirtualTagDefinition,
} from '@crane/domain/virtual-tag';
import {
  collectVirtualBays,
  countVirtualTagsByGroup,
  filterVirtualEquipments,
  filterVirtualTags,
  formatVirtualValue,
  groupVirtualTags,
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
    enabled: true,
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
    groups: [],
    tags: [],
    ...patch,
  };
}

const equipments = [
  equipment('GC-04', { name: 'Goliath', bay: 'B2' }),
  equipment('C_171', { bay: 'B1' }),
  equipment('C_172', { bay: 'B1' }),
  equipment('LLC_002', { name: 'Level luffing' }),
];

describe('collectVirtualBays / filterVirtualEquipments', () => {
  it('구역이 있는 장비만 세어 이름순으로', () => {
    expect(collectVirtualBays(equipments)).toEqual([
      { bay: 'B1', count: 2 },
      { bay: 'B2', count: 1 },
    ]);
    expect(collectVirtualBays([])).toEqual([]);
  });

  it('구역 칩과 검색어(ID·이름·구역, 대소문자·공백 무시)로 거르고 순서를 지킨다', () => {
    expect(
      filterVirtualEquipments(equipments, 'all', '').map((e) => e.craneId),
    ).toEqual(['GC-04', 'C_171', 'C_172', 'LLC_002']);
    expect(
      filterVirtualEquipments(equipments, 'B1', '').map((e) => e.craneId),
    ).toEqual(['C_171', 'C_172']);
    expect(
      filterVirtualEquipments(equipments, 'all', ' gol ').map((e) => e.craneId),
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

describe('groupVirtualTags / countVirtualTagsByGroup', () => {
  const grouped = equipment('GC', {
    groups: [
      { id: 'g-m', name: '계측값', preset: 'measurement' },
      { id: 'g-s', name: '상태' },
      { id: 'g-empty', name: '빈 그룹' },
    ],
    tags: [
      tag('gantry', { groupId: 'g-m', name: '주행' }),
      tag('trolley', { groupId: 'g-m' }),
      tag('power', { groupId: 'g-s' }),
      tag('loose'),
      tag('orphan', { groupId: 'gone' }),
    ],
  });

  it('전체: 그룹 순서대로 빈 그룹까지 두고 미분류(없는 그룹 포함)는 끝에', () => {
    const sections = groupVirtualTags(grouped, 'all', '');
    expect(sections.map((s) => s.group?.id ?? null)).toEqual([
      'g-m',
      'g-s',
      'g-empty',
      null,
    ]);
    expect(sections[0].tags.map((t) => t.code)).toEqual(['gantry', 'trolley']);
    expect(sections[2].tags).toEqual([]);
    expect(sections[3].tags.map((t) => t.code)).toEqual(['loose', 'orphan']);
  });

  it('미분류 태그가 없으면 미분류 묶음이 없고, 미분류 필터면 비어도 보인다', () => {
    const noLoose = { ...grouped, tags: grouped.tags.slice(0, 3) };
    expect(
      groupVirtualTags(noLoose, 'all', '').map((s) => s.group?.id ?? null),
    ).toEqual(['g-m', 'g-s', 'g-empty']);
    expect(groupVirtualTags(noLoose, 'ungrouped', '')).toEqual([
      { group: null, tags: [] },
    ]);
  });

  it('그룹 필터는 그 묶음만, 검색어는 맞는 태그가 있는 묶음만 남긴다', () => {
    expect(
      groupVirtualTags(grouped, 'g-s', '').map((s) => [
        s.group?.id,
        s.tags.map((t) => t.code),
      ]),
    ).toEqual([['g-s', ['power']]]);
    expect(
      groupVirtualTags(grouped, 'all', '주행').map((s) => [
        s.group?.id ?? null,
        s.tags.map((t) => t.code),
      ]),
    ).toEqual([['g-m', ['gantry']]]);
    expect(
      groupVirtualTags(grouped, 'all', 'o').map((s) => s.group?.id ?? null),
    ).toEqual(['g-m', 'g-s', null]);
    expect(groupVirtualTags(grouped, 'ungrouped', 'zzz')).toEqual([]);
    expect(groupVirtualTags(grouped, 'g-m', 'power')).toEqual([]);
  });

  it('그룹별 개수 — 없는 그룹을 가리키는 태그는 미분류로 센다', () => {
    expect(countVirtualTagsByGroup(grouped)).toEqual({
      ungrouped: 2,
      'g-m': 2,
      'g-s': 1,
      'g-empty': 0,
    });
    expect(countVirtualTagsByGroup({ groups: [], tags: [] })).toEqual({
      ungrouped: 0,
    });
  });

  it('filterVirtualTags 는 코드·이름 부분 일치, 빈 검색어는 복사본 전부', () => {
    const out = filterVirtualTags(grouped.tags, '');
    expect(out).toEqual(grouped.tags);
    expect(out).not.toBe(grouped.tags);
    expect(filterVirtualTags(grouped.tags, 'TROL').map((t) => t.code)).toEqual([
      'trolley',
    ]);
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
