import { describe, expect, it } from 'vitest';
import {
  createDefaultGroups,
  findPresetGroup,
  toGroupPreset,
} from '../default-groups';
import { VIRTUAL_TAG_GROUP_NAME_MAX } from '../../model/types';

const names = {
  datetime: ' 시각 ',
  measurement: '계측값',
  status: 's'.repeat(VIRTUAL_TAG_GROUP_NAME_MAX + 4),
};

describe('createDefaultGroups', () => {
  it('표식 순서대로 세 그룹, 이름은 trim·길이 제한, id 는 넘긴 생성기에서', () => {
    let n = 0;
    const groups = createDefaultGroups(names, () => `g${++n}`);
    expect(groups.map((g) => g.preset)).toEqual([
      'datetime',
      'measurement',
      'status',
    ]);
    expect(groups.map((g) => g.id)).toEqual(['g1', 'g2', 'g3']);
    expect(groups[0].name).toBe('시각');
    expect(groups[2].name).toHaveLength(VIRTUAL_TAG_GROUP_NAME_MAX);
  });
});

describe('toGroupPreset / findPresetGroup', () => {
  it('실시간 묶음 문자열을 표식으로 — 모르는 값은 status', () => {
    expect(toGroupPreset('datetime')).toBe('datetime');
    expect(toGroupPreset('measurement')).toBe('measurement');
    expect(toGroupPreset('status')).toBe('status');
    expect(toGroupPreset('alarm')).toBe('status');
    expect(toGroupPreset('')).toBe('status');
  });

  it('이름을 바꿔도 표식으로 찾고, 없으면 undefined', () => {
    const groups = createDefaultGroups(names, () => 'x').map((g, i) => ({
      ...g,
      id: `g${i}`,
      name: `renamed ${i}`,
    }));
    expect(findPresetGroup(groups, 'measurement')?.id).toBe('g1');
    expect(findPresetGroup([{ id: 'a', name: 'free' }], 'status')).toBe(
      undefined,
    );
  });
});
