import { describe, expect, it } from 'vitest';
import type { TagRow } from '@crane/features/3d';
import {
  CHIP_TAIL_KEEP,
  describeCodeChip,
  filterPickTags,
  findSnapshotEntry,
  splitChipTail,
} from '../tag-pick';

function row(code: string, name: string, category: TagRow['category']): TagRow {
  return {
    code,
    name,
    category,
    unit: null,
    alarm: false,
    value: 0,
    timestamp: null,
    stat: { changedAt: null, changeCount: 0, min: null, max: null },
  };
}
const rows = [
  row('tl_distance', 'TL Distance', 'measurement'),
  row('ts1_distance', 'TS#1 Distance', 'measurement'),
  row('heartbeat', 'Heartbeat', 'status'),
];

describe('findSnapshotEntry', () => {
  const cranes = { C_171: { id: 1 }, C_800: { id: 2 }, broken: undefined };

  it('모델 craneId 를 -/_ 정규화해 스토어 항목을 찾는다', () => {
    expect(findSnapshotEntry(cranes, 'C-171')).toEqual({
      craneId: 'C_171',
      entry: { id: 1 },
    });
    expect(findSnapshotEntry(cranes, 'C_800')?.entry).toEqual({ id: 2 });
  });

  it('없거나 craneId 가 없거나 항목이 비면 null', () => {
    expect(findSnapshotEntry(cranes, 'C_999')).toBeNull();
    expect(findSnapshotEntry(cranes, undefined)).toBeNull();
    expect(findSnapshotEntry(cranes, '')).toBeNull();
    expect(findSnapshotEntry(cranes, 'broken')).toBeNull();
    expect(findSnapshotEntry({}, 'C_171')).toBeNull();
  });
});

describe('filterPickTags', () => {
  it('코드·표시명 부분 일치로 거르고, 빈 검색어는 전부(새 배열)', () => {
    const all = filterPickTags(rows, '');
    expect(all).toEqual(rows);
    expect(all).not.toBe(rows);
    expect(filterPickTags(rows, ' ts#1 ').map((r) => r.code)).toEqual([
      'ts1_distance',
    ]);
    expect(filterPickTags(rows, 'distance')).toHaveLength(2);
    expect(filterPickTags(rows, 'zzz')).toEqual([]);
  });
});

describe('describeCodeChip', () => {
  it('코드를 보이고 툴팁에 조립 키·표시명·단위를 적는다', () => {
    expect(describeCodeChip('tl_distance', 'C-171', 'indoor')).toEqual({
      text: 'tl_distance',
      title: 'C_171.tl_distance · TL Distance · m',
      unresolved: false,
    });
  });

  it('craneId 가 없으면 키 없이 unresolved', () => {
    expect(describeCodeChip('heartbeat', undefined, 'indoor')).toEqual({
      text: 'heartbeat',
      title: 'Heartbeat',
      unresolved: true,
    });
  });

  it('카탈로그는 내업 것이라 외업·범위 없음은 키만 적는다', () => {
    const code = '4_Crane.4_CR01.4_POS.04_Center_POS_y1';
    expect(describeCodeChip(code, 'GC-01', 'outdoor')).toEqual({
      text: code,
      title: `GC_01.${code}`,
      unresolved: false,
    });
    expect(describeCodeChip('tl_distance', 'C_171', null).title).toBe(
      'C_171.tl_distance',
    );
    expect(describeCodeChip(code, undefined, 'outdoor')).toEqual({
      text: code,
      title: '',
      unresolved: true,
    });
  });
});

describe('splitChipTail', () => {
  it('코드 끝 글자를 따로 떼어 번호가 보이게 하고, 짧은 코드는 나누지 않는다', () => {
    expect(splitChipTail('trolley_position_2')).toEqual({
      head: 'trolley_positi',
      end: 'on_2',
    });
    const short = 'a'.repeat(CHIP_TAIL_KEEP * 2);
    expect(splitChipTail(short)).toEqual({ head: short, end: '' });
    expect(splitChipTail(`${short}b`)).toEqual({
      head: `${short}b`.slice(0, -CHIP_TAIL_KEEP),
      end: `${short}b`.slice(-CHIP_TAIL_KEEP),
    });
  });
});
