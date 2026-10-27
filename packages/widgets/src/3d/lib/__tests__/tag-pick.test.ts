import { describe, expect, it } from 'vitest';
import type { TagCatalogEntry, TagRow } from '@crane/features/3d';
import {
  describePickSelection,
  describeSlotChip,
  describeTagKey,
  filterPickCranes,
  filterPickEquipments,
  filterPickTags,
  filterPickVirtualTags,
  filterTagCatalog,
  pickInitialCrane,
  pickInitialEquipment,
  pickInitialSlot,
  resolveSelectedCrane,
  resolveSelectedEquipment,
  splitChipTail,
  selectedCodeForCrane,
} from '../tag-pick';

function entry(
  craneId: string,
  code: string,
  patch: Partial<TagCatalogEntry> = {},
): TagCatalogEntry {
  return {
    key: `${craneId.replace(/-/g, '_')}:${code}`,
    name: code,
    code,
    equipmentId: `e-${craneId}`,
    craneId,
    dataType: 'number',
    min: 0,
    max: 100,
    enabled: true,
    source: 'virtual',
    ...patch,
  };
}

const cranes = {
  C_171: { snapshot: { bay: 'F1_3_Bay' } },
  C_800: { snapshot: { bay: 'F1_3_Bay' } },
  C_810: { snapshot: { bay: 'F3_3_Fac' } },
  C_999: { snapshot: { bay: null } },
};
const order = ['C_171', 'C_800', 'C_810', 'C_999'];

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

describe('filterPickCranes', () => {
  it('검색어가 없으면 구역 칩만 — 전체면 전부, 구역이면 그 구역만(bay 없는 크레인 제외)', () => {
    expect(filterPickCranes(order, cranes, 'all', '')).toEqual({
      craneIds: order,
      craneMatched: false,
    });
    expect(filterPickCranes(order, cranes, 'F1_3_Bay', '  ')).toEqual({
      craneIds: ['C_171', 'C_800'],
      craneMatched: false,
    });
  });

  it('크레인에 맞는 검색어는 크레인을 거른다 — ID·구역, 대소문자·공백 무시', () => {
    expect(filterPickCranes(order, cranes, 'all', ' c_8 ')).toEqual({
      craneIds: ['C_800', 'C_810'],
      craneMatched: true,
    });
    expect(filterPickCranes(order, cranes, 'all', 'fac').craneIds).toEqual([
      'C_810',
    ]);
  });

  it('크레인에 안 맞는 검색어는 크레인을 전부 두고 craneMatched=false', () => {
    expect(filterPickCranes(order, cranes, 'all', 'distance')).toEqual({
      craneIds: order,
      craneMatched: false,
    });
  });

  it('구역 칩과 검색어는 함께 적용된다 — 칩 밖 크레인은 검색어에 맞아도 안 보인다', () => {
    expect(filterPickCranes(order, cranes, 'F3_3_Fac', 'C_1').craneIds).toEqual(
      ['C_810'],
    );
  });

  it('스토어에 없는 id 는 목록에서 뺀다', () => {
    expect(
      filterPickCranes(['ghost', 'C_171'], cranes, 'all', '').craneIds,
    ).toEqual(['C_171']);
  });
});

describe('filterPickTags', () => {
  it('크레인에 맞은 검색어면 전부(새 배열), 아니면 코드·표시명으로 거른다', () => {
    const all = filterPickTags(rows, 'C_171', true);
    expect(all).toEqual(rows);
    expect(all).not.toBe(rows);
    expect(filterPickTags(rows, 'distance', false).map((r) => r.code)).toEqual([
      'tl_distance',
      'ts1_distance',
    ]);
    expect(filterPickTags(rows, 'TS#1', false).map((r) => r.code)).toEqual([
      'ts1_distance',
    ]);
    expect(filterPickTags(rows, 'nothing', false)).toEqual([]);
    expect(filterPickTags(rows, '', false)).toEqual(rows);
  });
});

describe('filterTagCatalog', () => {
  const catalog: TagCatalogEntry[] = [
    entry('GC-04', 'gantry_position', { name: '주행' }),
    entry('LLC_002', 'luff_angle', { name: '러핑 각도' }),
  ];

  it('키·코드·이름 부분 일치, 빈 검색어는 전부(새 배열)', () => {
    expect(filterTagCatalog(catalog, ' ').map((e) => e.key)).toEqual([
      'GC_04:gantry_position',
      'LLC_002:luff_angle',
    ]);
    expect(filterTagCatalog(catalog, '')).not.toBe(catalog);
    expect(filterTagCatalog(catalog, 'luff').map((e) => e.key)).toEqual([
      'LLC_002:luff_angle',
    ]);
    expect(filterTagCatalog(catalog, '주행').map((e) => e.key)).toEqual([
      'GC_04:gantry_position',
    ]);
    expect(filterTagCatalog(catalog, 'gc_04').map((e) => e.key)).toEqual([
      'GC_04:gantry_position',
    ]);
    expect(filterTagCatalog(catalog, 'zzz')).toEqual([]);
  });
});

describe('가상 탭 — 장비 목록·처음 고를 장비', () => {
  const equipments = [
    {
      id: 'e-GC-04',
      craneId: 'GC-04',
      bay: 'B1',
      enabled: true,
      entries: [
        entry('GC-04', 'gantry'),
        entry('GC-04', 'power'),
        entry('GC-04', 'loose'),
      ],
    },
    {
      id: 'e-LLC_002',
      craneId: 'LLC_002',
      enabled: false,
      entries: [entry('LLC_002', 'luff')],
    },
  ];

  it('filterPickEquipments — ID·구역에 맞으면 거르고, 안 맞으면 전부(태그 검색어)', () => {
    expect(filterPickEquipments(equipments, '')).toEqual({
      equipments,
      equipmentMatched: false,
    });
    expect(filterPickEquipments(equipments, '')).not.toBe(equipments);
    expect(
      filterPickEquipments(equipments, ' gc ').equipments.map((e) => e.id),
    ).toEqual(['e-GC-04']);
    expect(filterPickEquipments(equipments, 'b1').equipmentMatched).toBe(true);
    expect(filterPickEquipments(equipments, 'luff')).toEqual({
      equipments,
      equipmentMatched: false,
    });
  });

  it('filterPickVirtualTags — 장비에 맞은 검색어면 전부, 아니면 코드·이름으로', () => {
    const entries = equipments[0].entries;
    expect(filterPickVirtualTags(entries, 'GC', true)).toEqual(entries);
    expect(
      filterPickVirtualTags(entries, 'pow', false).map((e) => e.code),
    ).toEqual(['power']);
  });

  it('pickInitialEquipment — 연결된 키의 장비 › 모델 craneId › 첫 장비, -/_ 표기를 맞춘다', () => {
    expect(pickInitialEquipment(equipments, 'GC-04', 'LLC_002:luff')?.id).toBe(
      'e-LLC_002',
    );
    expect(pickInitialEquipment(equipments, 'GC_04', undefined)?.id).toBe(
      'e-GC-04',
    );
    expect(
      pickInitialEquipment(equipments, 'zz', 'C_171.tl_distance')?.id,
    ).toBe('e-GC-04');
    expect(pickInitialEquipment([], 'GC-04', undefined)).toBeNull();
  });

  it('resolveSelectedEquipment — 고른 장비가 목록에 있으면 유지, 없으면 처음 규칙', () => {
    expect(
      resolveSelectedEquipment('e-LLC_002', equipments, 'GC-04', undefined)?.id,
    ).toBe('e-LLC_002');
    expect(
      resolveSelectedEquipment('gone', equipments, 'GC-04', undefined)?.id,
    ).toBe('e-GC-04');
    expect(
      resolveSelectedEquipment(null, equipments, undefined, undefined)?.id,
    ).toBe('e-GC-04');
  });
});

describe('pickInitialCrane / resolveSelectedCrane', () => {
  it('연결된 키의 크레인 › 모델 craneId › 첫 크레인 순이고 -/_ 표기를 맞춘다', () => {
    expect(pickInitialCrane(order, 'C_800', 'C_810.tl_distance')).toBe('C_810');
    expect(pickInitialCrane(order, 'C-800', undefined)).toBe('C_800');
    expect(pickInitialCrane(order, 'C_000', 'C_000.x')).toBe('C_171');
    expect(pickInitialCrane(order, undefined, 'GC_04:gantry_position')).toBe(
      'C_171',
    );
    expect(pickInitialCrane([], 'C_800', undefined)).toBeNull();
  });

  it('고른 크레인이 목록에 있으면 유지, 없으면 처음 규칙으로', () => {
    expect(resolveSelectedCrane('C_810', order, 'C_800', undefined)).toBe(
      'C_810',
    );
    expect(
      resolveSelectedCrane('C_810', ['C_171', 'C_800'], 'C_800', undefined),
    ).toBe('C_800');
    expect(resolveSelectedCrane(null, order, undefined, undefined)).toBe(
      'C_171',
    );
  });
});

describe('pickInitialSlot', () => {
  it('키가 있는 첫 슬롯 — 둘 다 있으면 실시간, 시뮬레이션만 있으면 시뮬레이션', () => {
    expect(
      pickInitialSlot({
        realtimeTagKey: 'C_171.tl_distance',
        virtualTagKey: 'GC_04:gantry_position',
      }),
    ).toBe('realtime');
    expect(pickInitialSlot({ virtualTagKey: 'GC_04:gantry_position' })).toBe(
      'virtual',
    );
    expect(pickInitialSlot({ realtimeTagKey: 'C_171.tl_distance' })).toBe(
      'realtime',
    );
  });

  it('둘 다 비면 실시간 — 빈 문자열은 키가 없는 것으로 본다', () => {
    expect(pickInitialSlot({})).toBe('realtime');
    expect(pickInitialSlot({ realtimeTagKey: '', virtualTagKey: '' })).toBe(
      'realtime',
    );
    expect(
      pickInitialSlot({ realtimeTagKey: '', virtualTagKey: 'V:only' }),
    ).toBe('virtual');
  });
});

describe('selectedCodeForCrane / describeTagKey / describeSlotChip / describePickSelection', () => {
  it('연결된 키가 그 크레인 것일 때만 코드를 돌려준다', () => {
    expect(selectedCodeForCrane('C_171.tl_distance', 'C_171')).toBe(
      'tl_distance',
    );
    expect(selectedCodeForCrane('C_171.tl_distance', 'C-171')).toBe(
      'tl_distance',
    );
    expect(selectedCodeForCrane('C_171.tl_distance', 'C_800')).toBeNull();
    expect(selectedCodeForCrane(undefined, 'C_171')).toBeNull();
    expect(selectedCodeForCrane('nocolon', 'C_171')).toBeNull();
  });

  it('실시간 키를 크레인·코드·표시명으로 풀고, 안 나뉘는 키는 null', () => {
    const desc = describeTagKey('C_171.tl_distance');
    expect(desc?.craneKey).toBe('C_171');
    expect(desc?.tagCode).toBe('tl_distance');
    expect(desc?.name.length).toBeGreaterThan(0);
    expect(describeTagKey('gantry')).toBeNull();
  });

  it('슬롯 칩 — 실시간은 크레인 · 코드, 가상은 장비 · 코드 + 이름·단위 툴팁, 못 찾으면 unknown', () => {
    const catalog: TagCatalogEntry[] = [
      entry('GC-04', 'gantry_position', { name: '주행', unit: 'm' }),
      entry('V', 'same'),
    ];
    const realtime = describeSlotChip('C_171.tl_distance', 'realtime', catalog);
    expect(realtime.text).toBe('C_171 · tl_distance');
    expect(realtime.lead).toBe('C_171 · ');
    expect(realtime.tail).toBe('tl_distance');
    expect(realtime.unknown).toBe(false);
    expect(realtime.title).toContain('m');
    expect(describeSlotChip('gantry', 'realtime', catalog)).toEqual({
      text: 'gantry',
      lead: '',
      tail: 'gantry',
      title: undefined,
      unknown: true,
    });
    expect(
      describeSlotChip('GC_04:gantry_position', 'virtual', catalog),
    ).toEqual({
      text: 'GC-04 · gantry_position',
      lead: 'GC-04 · ',
      tail: 'gantry_position',
      title: '주행 · m',
      unknown: false,
    });
    // 이름이 코드와 같고 단위가 없으면 툴팁 없음.
    expect(
      describeSlotChip('V:same', 'virtual', catalog).title,
    ).toBeUndefined();
    // 카탈로그에 없는 가상 키는 키 그대로 + unknown.
    expect(describeSlotChip('V:gone', 'virtual', catalog)).toEqual({
      text: 'V:gone',
      lead: 'V:',
      tail: 'gone',
      title: undefined,
      unknown: true,
    });
  });

  it('칩의 앞부분·코드는 마지막 : 또는 . 에서 나누고, 이어 붙이면 늘 text 다', () => {
    const split = (key: string, slot: 'realtime' | 'virtual' = 'virtual') => {
      const chip = describeSlotChip(key, slot, []);
      expect(chip.lead + chip.tail).toBe(chip.text);
      return [chip.lead, chip.tail];
    };
    // 구분자가 여럿이면 마지막 것 — 점·콜론이 섞여도 같다.
    expect(split('A:B:c')).toEqual(['A:B:', 'c']);
    expect(split('A:b.c')).toEqual(['A:b.', 'c']);
    // 못 푸는 실시간 키(가상 표기)도 같은 규칙.
    expect(split('GC_04:gantry_position', 'realtime')).toEqual([
      'GC_04:',
      'gantry_position',
    ]);
    // 구분자가 양 끝이거나 없으면 나누지 않는다 — 빈 코드를 만들지 않는다.
    expect(split('GC_04:')).toEqual(['', 'GC_04:']);
    expect(split(':gantry')).toEqual(['', ':gantry']);
    expect(split('plain')).toEqual(['', 'plain']);
    expect(split('')).toEqual(['', '']);
  });

  it('코드 끝 4글자를 따로 떼어 번호가 보이게 하고, 8글자 이하는 나누지 않는다', () => {
    expect(splitChipTail('trolley_position_2')).toEqual({
      head: 'trolley_positi',
      end: 'on_2',
    });
    expect(splitChipTail('trolley_position')).toEqual({
      head: 'trolley_posi',
      end: 'tion',
    });
    // 경계 — 8글자는 그대로, 9글자부터 나눈다.
    expect(splitChipTail('abcdefgh')).toEqual({ head: 'abcdefgh', end: '' });
    expect(splitChipTail('abcdefghi')).toEqual({ head: 'abcde', end: 'fghi' });
    expect(splitChipTail('')).toEqual({ head: '', end: '' });
  });

  it('빵부스러기는 크레인 › 분류 › 이름 (코드)', () => {
    expect(describePickSelection('C_171', rows[0], '계측값')).toBe(
      'C_171 › 계측값 › TL Distance (tl_distance)',
    );
  });
});
