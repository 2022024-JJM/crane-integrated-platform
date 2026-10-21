import { describe, expect, it } from 'vitest';
import type { TagCatalogEntry, TagRow } from '@crane/features/3d';
import {
  describePickSelection,
  describeSlotChip,
  describeTagKey,
  filterPickCranes,
  filterPickTags,
  filterTagCatalog,
  pickInitialCrane,
  resolveSelectedCrane,
  selectedCodeForCrane,
} from '../tag-pick';

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
    { key: 'GC_04:gantry_position', name: 'GC-04 주행', source: 'virtual' },
    { key: 'LLC_002:luff_angle', name: 'LLC-002 러핑 각도', source: 'virtual' },
  ];

  it('키·이름 부분 일치, 빈 검색어는 전부(새 배열)', () => {
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
    expect(filterTagCatalog(catalog, 'zzz')).toEqual([]);
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

  it('슬롯 칩 — 실시간은 크레인 · 코드, 가상은 키 + 카탈로그 이름, 못 찾으면 unknown', () => {
    const catalog: TagCatalogEntry[] = [
      {
        key: 'GC_04:gantry_position',
        name: 'GC-04 주행',
        unit: 'm',
        source: 'virtual',
      },
      { key: 'V:same', name: 'V:same', source: 'virtual' },
    ];
    const realtime = describeSlotChip('C_171.tl_distance', 'realtime', catalog);
    expect(realtime.text).toBe('C_171 · tl_distance');
    expect(realtime.unknown).toBe(false);
    expect(realtime.title).toContain('m');
    expect(describeSlotChip('gantry', 'realtime', catalog)).toEqual({
      text: 'gantry',
      title: undefined,
      unknown: true,
    });
    expect(
      describeSlotChip('GC_04:gantry_position', 'virtual', catalog),
    ).toEqual({
      text: 'GC_04:gantry_position',
      title: 'GC-04 주행 · m',
      unknown: false,
    });
    // 이름이 키와 같고 단위가 없으면 툴팁 없음.
    expect(
      describeSlotChip('V:same', 'virtual', catalog).title,
    ).toBeUndefined();
    expect(describeSlotChip('V:gone', 'virtual', catalog).unknown).toBe(true);
  });

  it('빵부스러기는 크레인 › 분류 › 이름 (코드)', () => {
    expect(describePickSelection('C_171', rows[0], '계측값')).toBe(
      'C_171 › 계측값 › TL Distance (tl_distance)',
    );
  });
});
