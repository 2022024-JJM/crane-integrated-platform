import { describe, expect, it } from 'vitest';
import {
  clampVirtualTagPeriod,
  clampVirtualTagTick,
  createEmptyVirtualTagSet,
  migrateVirtualTagSetV1,
  sanitizeVirtualEquipment,
  sanitizeVirtualEquipmentList,
  sanitizeVirtualTag,
  sanitizeVirtualTagGroup,
  sanitizeVirtualTagGroupList,
  sanitizeVirtualTagLimits,
  sanitizeVirtualTagList,
  sanitizeVirtualTagPattern,
  sanitizeVirtualTagSet,
  VIRTUAL_UNASSIGNED_EQUIPMENT_ID,
} from '../sanitize-virtual-tags';
import { buildVirtualTagKey } from '../virtual-tag-key';
import {
  VIRTUAL_EQUIPMENT_BAY_MAX,
  VIRTUAL_EQUIPMENT_GROUPS_MAX,
  VIRTUAL_EQUIPMENT_ID_MAX,
  VIRTUAL_EQUIPMENT_NAME_MAX,
  VIRTUAL_EQUIPMENT_TAGS_MAX,
  VIRTUAL_EQUIPMENTS_MAX,
  VIRTUAL_TAG_CODE_MAX,
  VIRTUAL_TAG_GROUP_NAME_MAX,
  VIRTUAL_TAG_NAME_MAX,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  VIRTUAL_TAG_PERIOD_MAX,
  VIRTUAL_TAG_PERIOD_MIN,
  VIRTUAL_TAG_TICK_DEFAULT,
  VIRTUAL_TAG_TICK_MAX,
  VIRTUAL_TAG_TICK_MIN,
} from '../../model/types';

const tag = {
  id: 'a',
  code: ' x ',
  name: 'X',
  unit: 'mm',
  min: -10,
  max: 10,
  initial: 3,
  pattern: { kind: 'triangle', periodMs: 2000 },
  enabled: true,
};

const group = { id: 'g1', name: ' 계측값 ', preset: 'measurement' };

const equipment = {
  id: 'e1',
  craneId: ' GC-04 ',
  name: 'Goliath',
  bay: 'B1',
  enabled: true,
  groups: [group],
  tags: [{ ...tag, groupId: 'g1' }],
};

describe('clamp helpers', () => {
  it('tick: 경계 정확값 통과, 밖은 클램프, 손상은 기본값', () => {
    expect(clampVirtualTagTick(VIRTUAL_TAG_TICK_MIN)).toBe(
      VIRTUAL_TAG_TICK_MIN,
    );
    expect(clampVirtualTagTick(VIRTUAL_TAG_TICK_MIN - 1)).toBe(
      VIRTUAL_TAG_TICK_MIN,
    );
    expect(clampVirtualTagTick(VIRTUAL_TAG_TICK_MAX)).toBe(
      VIRTUAL_TAG_TICK_MAX,
    );
    expect(clampVirtualTagTick(VIRTUAL_TAG_TICK_MAX + 1)).toBe(
      VIRTUAL_TAG_TICK_MAX,
    );
    expect(clampVirtualTagTick(33.4)).toBe(33);
    expect(clampVirtualTagTick('100')).toBe(VIRTUAL_TAG_TICK_DEFAULT);
    expect(clampVirtualTagTick(NaN)).toBe(VIRTUAL_TAG_TICK_DEFAULT);
  });

  it('period: 같은 규칙', () => {
    expect(clampVirtualTagPeriod(VIRTUAL_TAG_PERIOD_MIN - 1)).toBe(
      VIRTUAL_TAG_PERIOD_MIN,
    );
    expect(clampVirtualTagPeriod(VIRTUAL_TAG_PERIOD_MAX + 1)).toBe(
      VIRTUAL_TAG_PERIOD_MAX,
    );
    expect(clampVirtualTagPeriod(Infinity)).toBe(VIRTUAL_TAG_PERIOD_DEFAULT);
  });
});

describe('sanitizeVirtualTagPattern', () => {
  it('모르는 종류·비객체는 manual', () => {
    expect(sanitizeVirtualTagPattern(null)).toEqual({ kind: 'manual' });
    expect(sanitizeVirtualTagPattern({ kind: 'noise' })).toEqual({
      kind: 'manual',
    });
  });

  it('주기 파형은 periodMs 클램프, square 는 dutyPct 를 [0,100] 으로', () => {
    expect(sanitizeVirtualTagPattern({ kind: 'sine', periodMs: 10 })).toEqual({
      kind: 'sine',
      periodMs: VIRTUAL_TAG_PERIOD_MIN,
    });
    expect(
      sanitizeVirtualTagPattern({
        kind: 'square',
        periodMs: 1000,
        dutyPct: 150,
      }),
    ).toEqual({
      kind: 'square',
      periodMs: 1000,
      dutyPct: 100,
    });
    expect(
      sanitizeVirtualTagPattern({
        kind: 'square',
        periodMs: 1000,
        dutyPct: 'x',
      }),
    ).toEqual({
      kind: 'square',
      periodMs: 1000,
    });
  });

  it('제거된 random-walk 저장본은 manual 로 떨어진다', () => {
    expect(
      sanitizeVirtualTagPattern({ kind: 'random-walk', stepPct: 5, seed: 1 }),
    ).toEqual({ kind: 'manual' });
  });
});

describe('sanitizeVirtualTagGroup / List', () => {
  it('id 필수, 이름은 trim·길이 제한, 모르는 표식은 뗀다', () => {
    expect(sanitizeVirtualTagGroup(group)).toEqual({
      id: 'g1',
      name: '계측값',
      preset: 'measurement',
    });
    expect(
      sanitizeVirtualTagGroup({
        id: 'g',
        name: 'n'.repeat(VIRTUAL_TAG_GROUP_NAME_MAX + 3),
        preset: 'alarm',
      }),
    ).toEqual({ id: 'g', name: 'n'.repeat(VIRTUAL_TAG_GROUP_NAME_MAX) });
    expect(sanitizeVirtualTagGroup({ id: 'g' })).toEqual({ id: 'g', name: '' });
    expect(sanitizeVirtualTagGroup({ name: 'no id' })).toBeNull();
    expect(sanitizeVirtualTagGroup('x')).toBeNull();
  });

  it('목록 — id 중복은 첫 항목, 순서 유지, 상한, 배열 아님은 빈 배열', () => {
    expect(
      sanitizeVirtualTagGroupList([
        { id: 'b', name: 'B' },
        { id: 'a', name: 'A' },
        { id: 'b', name: 'dup' },
        null,
      ]).map((g) => g.name),
    ).toEqual(['B', 'A']);
    expect(
      sanitizeVirtualTagGroupList(
        Array.from({ length: VIRTUAL_EQUIPMENT_GROUPS_MAX + 1 }, (_, i) => ({
          id: `g${i}`,
          name: '',
        })),
      ),
    ).toHaveLength(VIRTUAL_EQUIPMENT_GROUPS_MAX);
    expect(sanitizeVirtualTagGroupList('x')).toEqual([]);
  });
});

describe('sanitizeVirtualTag — 숫자', () => {
  it('유효 항목은 trim·클램프해 통과하고 형식은 number 로 채운다', () => {
    expect(sanitizeVirtualTag(tag)).toEqual({
      id: 'a',
      code: 'x',
      name: 'X',
      dataType: 'number',
      unit: 'mm',
      min: -10,
      max: 10,
      initial: 3,
      pattern: { kind: 'triangle', periodMs: 2000 },
      enabled: true,
    });
    expect(sanitizeVirtualTag({ ...tag, dataType: 'float' })?.dataType).toBe(
      'number',
    );
  });

  it('id 가 없거나 코드가 비었거나 공백·콜론이 있거나 길면 버린다', () => {
    expect(sanitizeVirtualTag({ ...tag, id: '' })).toBeNull();
    expect(sanitizeVirtualTag({ ...tag, code: '  ' })).toBeNull();
    expect(sanitizeVirtualTag({ ...tag, code: 'a b' })).toBeNull();
    expect(sanitizeVirtualTag({ ...tag, code: 'a:b' })).toBeNull();
    expect(
      sanitizeVirtualTag({ ...tag, code: 'c'.repeat(VIRTUAL_TAG_CODE_MAX) }),
    ).not.toBeNull();
    expect(
      sanitizeVirtualTag({
        ...tag,
        code: 'c'.repeat(VIRTUAL_TAG_CODE_MAX + 1),
      }),
    ).toBeNull();
    expect(sanitizeVirtualTag('garbage')).toBeNull();
  });

  it('groupId 는 주어진 그룹 집합에 있을 때만 남고, 집합이 없으면 그대로 둔다', () => {
    const groupIds = new Set(['g1']);
    expect(
      sanitizeVirtualTag({ ...tag, groupId: 'g1' }, groupIds)?.groupId,
    ).toBe('g1');
    expect(
      sanitizeVirtualTag({ ...tag, groupId: 'gone' }, groupIds),
    ).not.toHaveProperty('groupId');
    expect(sanitizeVirtualTag({ ...tag, groupId: 'any' })?.groupId).toBe('any');
    expect(sanitizeVirtualTag({ ...tag, groupId: '' })).not.toHaveProperty(
      'groupId',
    );
    expect(sanitizeVirtualTag({ ...tag, groupId: 7 })).not.toHaveProperty(
      'groupId',
    );
  });

  it('min ≥ max 면 최소 폭 1 을 주고, initial 은 범위로 클램프, 이름은 길이 제한', () => {
    const out = sanitizeVirtualTag({
      ...tag,
      min: 5,
      max: 5,
      initial: 99,
      name: 'n'.repeat(VIRTUAL_TAG_NAME_MAX + 5),
      unit: '',
      enabled: 'yes',
    });
    expect(out).toMatchObject({ min: 5, max: 6, initial: 6, enabled: true });
    expect(out?.name).toHaveLength(VIRTUAL_TAG_NAME_MAX);
    expect(out).not.toHaveProperty('unit');
  });

  it('숫자 손상(NaN·문자열)은 기본값으로', () => {
    expect(
      sanitizeVirtualTag({ ...tag, min: NaN, max: 'x', initial: 'y' }),
    ).toMatchObject({
      min: 0,
      max: 100,
      initial: 0,
    });
    expect(sanitizeVirtualTag({ ...tag, enabled: false })?.enabled).toBe(false);
  });
});

describe('sanitizeVirtualTag — 불리언', () => {
  const bool = { ...tag, dataType: 'bool' };

  it('범위 0~1·초기값 0/1 로 강제하고 단위·한계를 뗀다', () => {
    const out = sanitizeVirtualTag({
      ...bool,
      min: -5,
      max: 50,
      initial: 0.7,
      limits: { maxSpeed: 1 },
      pattern: { kind: 'manual' },
    });
    expect(out).toEqual({
      id: 'a',
      code: 'x',
      name: 'X',
      dataType: 'bool',
      min: 0,
      max: 1,
      initial: 1,
      pattern: { kind: 'manual' },
      enabled: true,
    });
    expect(sanitizeVirtualTag({ ...bool, initial: -3 })?.initial).toBe(0);
    expect(sanitizeVirtualTag({ ...bool, initial: 'x' })?.initial).toBe(0);
    expect(sanitizeVirtualTag({ ...bool, initial: 0.49 })?.initial).toBe(0);
  });

  it('패턴은 manual·square 만 — 다른 파형은 manual 로', () => {
    expect(
      sanitizeVirtualTag({ ...bool, pattern: { kind: 'sine', periodMs: 1000 } })
        ?.pattern,
    ).toEqual({ kind: 'manual' });
    expect(
      sanitizeVirtualTag({
        ...bool,
        pattern: { kind: 'square', periodMs: 1000, dutyPct: 30 },
      })?.pattern,
    ).toEqual({ kind: 'square', periodMs: 1000, dutyPct: 30 });
  });

  it('groupId 규칙은 숫자와 같다', () => {
    expect(
      sanitizeVirtualTag({ ...bool, groupId: 'g1' }, new Set(['g1']))?.groupId,
    ).toBe('g1');
    expect(
      sanitizeVirtualTag({ ...bool, groupId: 'g9' }, new Set(['g1'])),
    ).not.toHaveProperty('groupId');
  });
});

describe('sanitizeVirtualTagList', () => {
  it('id·code 중복은 첫 항목, 손상은 건너뛰고, 상한을 넘기지 않는다', () => {
    const list = sanitizeVirtualTagList([
      tag,
      { ...tag, id: 'b' }, // code 중복
      { ...tag, code: 'other' }, // id 중복
      null,
      { ...tag, id: 'c', code: 'c' },
    ]);
    expect(list.map((t) => t.id)).toEqual(['a', 'c']);

    const many = Array.from(
      { length: VIRTUAL_EQUIPMENT_TAGS_MAX + 1 },
      (_, i) => ({ ...tag, id: `id-${i}`, code: `k-${i}` }),
    );
    expect(sanitizeVirtualTagList(many)).toHaveLength(
      VIRTUAL_EQUIPMENT_TAGS_MAX,
    );
    expect(sanitizeVirtualTagList('x')).toEqual([]);
  });
});

describe('sanitizeVirtualEquipment / List', () => {
  it('유효 장비는 trim 해 통과하고 태그의 groupId 를 그룹 목록으로 거른다', () => {
    const out = sanitizeVirtualEquipment({
      ...equipment,
      tags: [
        { ...tag, groupId: 'g1' },
        { ...tag, id: 'b', code: 'y', groupId: 'gone' },
      ],
    });
    expect(out).toMatchObject({
      id: 'e1',
      craneId: 'GC-04',
      name: 'Goliath',
      bay: 'B1',
      enabled: true,
      groups: [{ id: 'g1', name: '계측값', preset: 'measurement' }],
    });
    expect(out?.tags.map((t) => t.groupId)).toEqual(['g1', undefined]);
  });

  it('id·장비 ID 필수 — 공백·콜론·길이 초과 ID 는 버린다', () => {
    expect(sanitizeVirtualEquipment({ ...equipment, id: '' })).toBeNull();
    expect(sanitizeVirtualEquipment({ ...equipment, craneId: ' ' })).toBeNull();
    expect(
      sanitizeVirtualEquipment({ ...equipment, craneId: 'GC 04' }),
    ).toBeNull();
    expect(
      sanitizeVirtualEquipment({ ...equipment, craneId: 'GC:04' }),
    ).toBeNull();
    expect(
      sanitizeVirtualEquipment({
        ...equipment,
        craneId: 'x'.repeat(VIRTUAL_EQUIPMENT_ID_MAX + 1),
      }),
    ).toBeNull();
    expect(sanitizeVirtualEquipment(null)).toBeNull();
  });

  it('이름·구역은 선택 — 빈 값은 떼고 길이는 자른다. enabled 는 false 만 false', () => {
    const out = sanitizeVirtualEquipment({
      ...equipment,
      name: 'n'.repeat(VIRTUAL_EQUIPMENT_NAME_MAX + 2),
      bay: 'b'.repeat(VIRTUAL_EQUIPMENT_BAY_MAX + 2),
      enabled: 'no',
      groups: 'x',
      tags: 'y',
    });
    expect(out?.name).toHaveLength(VIRTUAL_EQUIPMENT_NAME_MAX);
    expect(out?.bay).toHaveLength(VIRTUAL_EQUIPMENT_BAY_MAX);
    expect(out).toMatchObject({ enabled: true, groups: [], tags: [] });
    const bare = sanitizeVirtualEquipment({
      id: 'e',
      craneId: 'C_1',
      name: '  ',
      bay: '',
      enabled: false,
    });
    expect(bare).toEqual({
      id: 'e',
      craneId: 'C_1',
      enabled: false,
      groups: [],
      tags: [],
    });
  });

  it('목록 — id 중복과 정규화 장비키 중복(GC-04 ↔ GC_04)은 첫 항목, 상한', () => {
    const list = sanitizeVirtualEquipmentList([
      equipment,
      { ...equipment, id: 'e2', craneId: 'GC_04' }, // 키 중복
      { ...equipment, craneId: 'C_1' }, // id 중복
      'garbage',
      { ...equipment, id: 'e3', craneId: 'C_2' },
    ]);
    expect(list.map((e) => e.id)).toEqual(['e1', 'e3']);

    const many = Array.from({ length: VIRTUAL_EQUIPMENTS_MAX + 1 }, (_, i) => ({
      ...equipment,
      id: `e-${i}`,
      craneId: `C_${i}`,
    }));
    expect(sanitizeVirtualEquipmentList(many)).toHaveLength(
      VIRTUAL_EQUIPMENTS_MAX,
    );
    expect(sanitizeVirtualEquipmentList('x')).toEqual([]);
  });
});

describe('sanitizeVirtualTagSet — 버전 2', () => {
  it('봉투가 아니면 빈 세트', () => {
    expect(sanitizeVirtualTagSet(null)).toEqual(createEmptyVirtualTagSet());
    expect(sanitizeVirtualTagSet('x')).toEqual(createEmptyVirtualTagSet());
    expect(createEmptyVirtualTagSet()).toEqual({
      version: 2,
      tickMs: VIRTUAL_TAG_TICK_DEFAULT,
      equipments: [],
    });
  });

  it('equipments 배열이 있으면 버전 2 로 정규화한다', () => {
    const out = sanitizeVirtualTagSet({
      version: 2,
      tickMs: 250,
      equipments: [equipment, { id: 'bad' }],
    });
    expect(out.version).toBe(2);
    expect(out.tickMs).toBe(250);
    expect(out.equipments.map((e) => e.id)).toEqual(['e1']);
  });

  it('tags 도 equipments 도 배열이 아니면 tick 만 살린 빈 세트', () => {
    expect(
      sanitizeVirtualTagSet({ version: 9, tickMs: 'x', tags: 'y' }),
    ).toEqual(createEmptyVirtualTagSet());
    expect(sanitizeVirtualTagSet({ tickMs: 250 })).toEqual({
      version: 2,
      tickMs: 250,
      equipments: [],
    });
  });
});

describe('버전 1 변환(migrateVirtualTagSetV1)', () => {
  const v1 = {
    version: 1,
    tickMs: 120,
    tags: [
      {
        id: 'gc04-gantry',
        key: 'GC_04:gantry_position',
        name: 'GC-04 주행',
        unit: 'm',
        min: 0,
        max: 300,
        initial: 0,
        pattern: { kind: 'sine', periodMs: 40000 },
        enabled: true,
        limits: { maxSpeed: 2.5, maxAccel: 0.5 },
      },
      {
        id: 'gc04-trolley',
        key: 'GC_04:trolley_position',
        name: '',
        min: -30,
        max: 0,
        initial: 0,
        pattern: { kind: 'manual' },
        enabled: false,
      },
      {
        id: 'llc-luff',
        key: 'LLC_002:luff_angle',
        min: -32,
        max: 11.75,
        initial: 0,
        pattern: { kind: 'sine', periodMs: 30000 },
        enabled: true,
      },
    ],
    scenarios: [{ id: 's', name: 'dropped', loop: false, tracks: [] }],
  };

  it('키를 첫 콜론에서 나눠 장비로 묶고, 조립한 키가 원래 문자열과 같다', () => {
    const out = migrateVirtualTagSetV1(v1);
    expect(out.version).toBe(2);
    expect(out.tickMs).toBe(120);
    expect(out.equipments.map((e) => [e.id, e.craneId])).toEqual([
      ['legacy-GC_04', 'GC_04'],
      ['legacy-LLC_002', 'LLC_002'],
    ]);
    const gc = out.equipments[0];
    expect(gc.tags.map((t) => t.code)).toEqual([
      'gantry_position',
      'trolley_position',
    ]);
    expect(gc.tags[0]).toEqual({
      id: 'gc04-gantry',
      code: 'gantry_position',
      name: 'GC-04 주행',
      dataType: 'number',
      unit: 'm',
      min: 0,
      max: 300,
      initial: 0,
      pattern: { kind: 'sine', periodMs: 40000 },
      enabled: true,
      limits: { maxSpeed: 2.5, maxAccel: 0.5 },
    });
    expect(gc.tags[1].enabled).toBe(false);
    expect(gc.groups).toEqual([]);
    for (const e of out.equipments) {
      for (const t of e.tags) {
        const original = v1.tags.find((raw) => raw.id === t.id)!;
        expect(buildVirtualTagKey(e.craneId, t.code)).toBe(original.key);
      }
    }
    expect(out).not.toHaveProperty('scenarios');
  });

  it('콜론 없는 키는 UNASSIGNED 장비에, 둘째 콜론·공백은 밑줄로', () => {
    const out = migrateVirtualTagSetV1([
      { id: 'a', key: 'lonely' },
      { id: 'b', key: 'A:b:c' },
      { id: 'c', key: ' A B : x y ' },
    ]);
    expect(out.equipments.map((e) => e.craneId)).toEqual([
      VIRTUAL_UNASSIGNED_EQUIPMENT_ID,
      'A',
      'A_B',
    ]);
    expect(out.equipments[0].tags[0].code).toBe('lonely');
    expect(out.equipments[1].tags[0].code).toBe('b_c');
    expect(out.equipments[2].tags[0].code).toBe('x_y');
  });

  it('하이픈·밑줄만 다른 장비는 하나로 묶이고 첫 표기가 남는다', () => {
    const out = migrateVirtualTagSetV1([
      { id: 'a', key: 'GC-04:x' },
      { id: 'b', key: 'GC_04:y' },
    ]);
    expect(out.equipments).toHaveLength(1);
    expect(out.equipments[0].craneId).toBe('GC-04');
    expect(out.equipments[0].tags.map((t) => t.code)).toEqual(['x', 'y']);
  });

  it('손상 항목은 건너뛰고, 변환은 멱등이다(같은 입력 → 같은 id)', () => {
    const out = migrateVirtualTagSetV1({
      tags: [null, { id: 'a' }, { id: 'b', key: ':' }, { id: 'c', key: 'E:k' }],
    });
    expect(out.equipments).toHaveLength(1);
    expect(out.equipments[0].tags.map((t) => t.id)).toEqual(['c']);
    const again = sanitizeVirtualTagSet(out);
    expect(again).toEqual(out);
    expect(migrateVirtualTagSetV1(v1)).toEqual(migrateVirtualTagSetV1(v1));
  });

  it('sanitizeVirtualTagSet 은 배열·tags 봉투를 버전 1 로 보고 변환한다', () => {
    expect(sanitizeVirtualTagSet(v1.tags)).toEqual(
      migrateVirtualTagSetV1({ tags: v1.tags }),
    );
    expect(sanitizeVirtualTagSet(v1)).toEqual(migrateVirtualTagSetV1(v1));
    expect(sanitizeVirtualTagSet(v1.tags).tickMs).toBe(
      VIRTUAL_TAG_TICK_DEFAULT,
    );
  });
});

describe('sanitizeVirtualTagLimits', () => {
  it('양의 유한수만 남기고, 둘 다 없으면 undefined', () => {
    expect(sanitizeVirtualTagLimits({ maxSpeed: 2, maxAccel: 0.5 })).toEqual({
      maxSpeed: 2,
      maxAccel: 0.5,
    });
    expect(
      sanitizeVirtualTagLimits({ maxSpeed: 0, maxAccel: -1 }),
    ).toBeUndefined();
    expect(sanitizeVirtualTagLimits({ maxSpeed: NaN, maxAccel: 1 })).toEqual({
      maxAccel: 1,
    });
    expect(sanitizeVirtualTagLimits('x')).toBeUndefined();
    expect(sanitizeVirtualTagLimits(undefined)).toBeUndefined();
    expect(
      sanitizeVirtualTag({ ...tag, limits: { maxSpeed: 1 } })?.limits,
    ).toEqual({
      maxSpeed: 1,
    });
    expect(sanitizeVirtualTag({ ...tag, limits: {} })).not.toHaveProperty(
      'limits',
    );
  });
});
