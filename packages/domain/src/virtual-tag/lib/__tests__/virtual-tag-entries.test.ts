import { describe, expect, it } from 'vitest';
import type { VirtualEquipment, VirtualTagDefinition } from '../../model/types';
import {
  collectVirtualTagEntries,
  findVirtualTagEntry,
} from '../virtual-tag-entries';

function tag(code: string): VirtualTagDefinition {
  return {
    id: `t-${code}`,
    code,
    name: '',
    dataType: 'number',
    min: 0,
    max: 1,
    initial: 0,
    pattern: { kind: 'manual' },
  };
}

const equipments: VirtualEquipment[] = [
  {
    id: 'e1',
    craneId: 'GC-04',
    enabled: true,
    tags: [tag('a'), tag('b')],
  },
  {
    id: 'e2',
    craneId: 'LLC_002',
    enabled: false,
    tags: [tag('c')],
  },
];

describe('collectVirtualTagEntries', () => {
  it('장비 순 › 태그 순으로 평탄화하고 키를 조립한다', () => {
    expect(collectVirtualTagEntries(equipments).map((e) => e.key)).toEqual([
      'GC_04:a',
      'GC_04:b',
      'LLC_002:c',
    ]);
    const first = collectVirtualTagEntries(equipments)[0];
    expect(first.equipment).toBe(equipments[0]);
    expect(first.tag).toBe(equipments[0].tags[0]);
  });

  it('enabledOnly 는 꺼진 장비의 태그 전부를 뺀다(태그별 켜짐은 없다)', () => {
    expect(
      collectVirtualTagEntries(equipments, { enabledOnly: true }).map(
        (e) => e.key,
      ),
    ).toEqual(['GC_04:a', 'GC_04:b']);
  });

  it('빈 목록·태그 없는 장비는 빈 배열', () => {
    expect(collectVirtualTagEntries([])).toEqual([]);
    expect(collectVirtualTagEntries([{ ...equipments[0], tags: [] }])).toEqual(
      [],
    );
  });
});

describe('findVirtualTagEntry', () => {
  it('키로 찾고, 꺼진 장비의 항목도 찾으며, 없으면 undefined', () => {
    expect(findVirtualTagEntry(equipments, 'LLC_002:c')?.tag.code).toBe('c');
    expect(
      findVirtualTagEntry(equipments, 'LLC_002:c')?.equipment.enabled,
    ).toBe(false);
    expect(findVirtualTagEntry(equipments, 'GC-04:a')).toBeUndefined();
    expect(findVirtualTagEntry(equipments, 'nope')).toBeUndefined();
  });
});
