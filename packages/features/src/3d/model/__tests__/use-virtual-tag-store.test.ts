// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VIRTUAL_EQUIPMENT_GROUPS_MAX,
  VIRTUAL_EQUIPMENT_TAGS_MAX,
  VIRTUAL_EQUIPMENTS_MAX,
  type VirtualTagDefinition,
  type VirtualTagSet,
} from '@crane/domain/virtual-tag';
import {
  resetVirtualTagLoadState,
  useVirtualTagStore,
} from '../use-virtual-tag-store';
import { virtualTagRuntime } from '../virtual-tag-runner';
import { setTagIngest, tagLiveValues } from '../tag-value-bus';

/**
 * 영속화 어댑터(virtual-tag-storage)는 도메인에서 따로 테스트한다 — 여기서는
 * mock 으로 "무엇을 넘기고 결과를 어떻게 반영하는가" 만 본다.
 */
const storage = vi.hoisted(() => ({
  load: vi.fn<() => Promise<VirtualTagSet>>(),
  save: vi.fn<(set: VirtualTagSet) => Promise<VirtualTagSet>>(),
}));

vi.mock('@crane/domain/virtual-tag', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@crane/domain/virtual-tag')>();
  return {
    ...actual,
    loadVirtualTagSet: storage.load,
    saveVirtualTagSet: storage.save,
  };
});

const received = new Map<string, number[]>();
const EMPTY: VirtualTagSet = { version: 2, tickMs: 100, equipments: [] };

function tagDef(
  id: string,
  code: string,
  patch: Partial<VirtualTagDefinition> = {},
): VirtualTagDefinition {
  return {
    id,
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

function reset() {
  useVirtualTagStore.getState().pause();
  useVirtualTagStore.setState({
    equipments: [],
    entries: [],
    tickMs: 100,
    savedSnapshot: JSON.stringify(EMPTY),
    hydrated: false,
    isSaving: false,
    isRunning: false,
  });
  resetVirtualTagLoadState();
  virtualTagRuntime.syncDefinitions([]);
  // 러너는 싱글턴이라 누적 재생 시간(elapsed)이 테스트 사이에 남는다.
  virtualTagRuntime.resetValues();
  received.clear();
  tagLiveValues.clear();
  storage.load.mockReset();
  storage.save.mockReset();
  storage.load.mockResolvedValue(EMPTY);
  storage.save.mockImplementation((set) => Promise.resolve(set));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  reset();
  setTagIngest((key, value) => {
    const list = received.get(key) ?? [];
    list.push(value);
    received.set(key, list);
  });
});

afterEach(() => {
  reset();
  setTagIngest(null);
  vi.useRealTimers();
});

const store = () => useVirtualTagStore.getState();

/** 장비 하나를 만들고 id 를 돌려준다(실패하면 throw). */
function addEquipment(craneId = 'C_1'): string {
  const result = store().addEquipment({ craneId });
  if (!result.ok) throw new Error(`addEquipment failed: ${result.reason}`);
  return result.id;
}

function addTag(
  equipmentId: string,
  draft: Parameters<ReturnType<typeof store>['addTag']>[1],
): string {
  const result = store().addTag(equipmentId, draft);
  if (!result.ok) throw new Error(`addTag failed: ${result.reason}`);
  return result.id;
}

describe('load / save / isDirty', () => {
  it('load 는 한 번만 읽고 스냅샷·평탄 목록·러너를 채운다 — 직후는 dirty 아님', async () => {
    const loaded: VirtualTagSet = {
      version: 2,
      tickMs: 250,
      equipments: [
        {
          id: 'e',
          craneId: 'C-1',
          enabled: true,
          groups: [],
          tags: [tagDef('a', 'x', { initial: 5 })],
        },
      ],
    };
    storage.load.mockResolvedValue(loaded);
    await Promise.all([store().load(), store().load()]);
    await store().load();
    expect(storage.load).toHaveBeenCalledTimes(1);
    expect(store().equipments.map((e) => e.id)).toEqual(['e']);
    expect(store().entries.map((e) => e.key)).toEqual(['C_1:x']);
    expect(store().tickMs).toBe(250);
    expect(store().isDirty()).toBe(false);
    expect(virtualTagRuntime.getValue('C_1:x')).toBe(5);
  });

  it('load 실패는 빈 세트로 시작하되 hydrated 를 세운다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.load.mockRejectedValue(new Error('404'));
    await store().load();
    expect(store().hydrated).toBe(true);
    expect(store().equipments).toEqual([]);
  });

  it('편집은 저장하지 않고 dirty 만 세운다. save 가 버전 2 세트를 넘기고 스냅샷을 갱신한다', async () => {
    await store().load();
    addEquipment();
    expect(storage.save).not.toHaveBeenCalled();
    expect(store().isDirty()).toBe(true);
    expect(await store().save()).toBe(true);
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({ version: 2, tickMs: 100 }),
    );
    expect(store().isDirty()).toBe(false);
    store().setTickMs(200);
    expect(store().isDirty()).toBe(true);
  });

  it('save 응답(정규화된 세트)을 상태에 반영한다', async () => {
    addEquipment();
    storage.save.mockImplementation((set) =>
      Promise.resolve({ ...set, tickMs: 16 }),
    );
    await store().save();
    expect(store().tickMs).toBe(16);
    expect(store().isDirty()).toBe(false);
  });

  it('save 실패는 false 이고 메모리 상태·dirty 를 유지한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    addEquipment();
    storage.save.mockRejectedValue(new Error('500'));
    expect(await store().save()).toBe(false);
    expect(store().equipments).toHaveLength(1);
    expect(store().isDirty()).toBe(true);
    expect(store().isSaving).toBe(false);
  });
});

describe('장비 CRUD', () => {
  it('추가는 ID 를 trim 하고 그룹 시드를 받는다. 빈·콜론·공백 ID 는 invalid-id', () => {
    const result = store().addEquipment({
      craneId: ' GC-04 ',
      name: 'Goliath',
      bay: 'B1',
      groups: [{ id: 'g1', name: '계측값', preset: 'measurement' }],
    });
    expect(result.ok).toBe(true);
    expect(store().equipments[0]).toMatchObject({
      craneId: 'GC-04',
      name: 'Goliath',
      bay: 'B1',
      enabled: true,
      groups: [{ id: 'g1', name: '계측값', preset: 'measurement' }],
      tags: [],
    });
    for (const craneId of ['  ', 'GC 04', 'GC:04']) {
      expect(store().addEquipment({ craneId })).toEqual({
        ok: false,
        reason: 'invalid-id',
      });
    }
  });

  it('정규화 키가 겹치면 duplicate-id(GC-04 ↔ GC_04), 상한은 limit', () => {
    addEquipment('GC-04');
    expect(store().addEquipment({ craneId: 'GC_04' })).toEqual({
      ok: false,
      reason: 'duplicate-id',
    });
    for (let i = store().equipments.length; i < VIRTUAL_EQUIPMENTS_MAX; i++) {
      expect(store().addEquipment({ craneId: `C_${i}` }).ok).toBe(true);
    }
    expect(store().addEquipment({ craneId: 'one-more' })).toEqual({
      ok: false,
      reason: 'limit',
    });
    expect(store().equipments).toHaveLength(VIRTUAL_EQUIPMENTS_MAX);
  });

  it('updateEquipment: ID 중복·손상이면 false 이고 다른 필드도 적용하지 않는다', () => {
    const a = addEquipment('A');
    addEquipment('B');
    const before = store().equipments;
    expect(store().updateEquipment(a, { craneId: 'B', name: 'x' })).toBe(false);
    expect(store().updateEquipment(a, { craneId: 'a b', name: 'x' })).toBe(
      false,
    );
    expect(store().equipments).toBe(before);
    expect(store().updateEquipment('missing', { name: 'x' })).toBe(false);
  });

  it('updateEquipment: ID 를 바꾸면 평탄 목록 키와 러너 키가 따라간다. 이름·구역·사용', () => {
    const a = addEquipment('A');
    addTag(a, { code: 'x', initial: 3 });
    expect(virtualTagRuntime.getValue('A:x')).toBe(3);
    expect(
      store().updateEquipment(a, { craneId: 'A-2', name: ' N ', bay: 'Z' }),
    ).toBe(true);
    expect(store().equipments[0]).toMatchObject({
      craneId: 'A-2',
      name: 'N',
      bay: 'Z',
    });
    expect(store().entries.map((e) => e.key)).toEqual(['A_2:x']);
    expect(virtualTagRuntime.getValue('A:x')).toBeUndefined();
    expect(virtualTagRuntime.getValue('A_2:x')).toBe(3);
    expect(store().updateEquipment(a, { enabled: false })).toBe(true);
    expect(store().equipments[0].enabled).toBe(false);
  });

  it('removeEquipment: 없는 id 는 참조 유지, 있으면 러너에서도 사라진다', () => {
    const a = addEquipment('A');
    addTag(a, { code: 'x' });
    const before = store().equipments;
    store().removeEquipment('missing');
    expect(store().equipments).toBe(before);
    store().removeEquipment(a);
    expect(store().equipments).toEqual([]);
    expect(store().entries).toEqual([]);
    expect(virtualTagRuntime.getValue('A:x')).toBeUndefined();
  });

  it('duplicateEquipment: 새 id·접미사 ID, 그룹·태그도 새 id 이고 groupId 가 따라간다', () => {
    const a = store().addEquipment({
      craneId: 'A',
      groups: [{ id: 'g1', name: 'G' }],
    });
    if (!a.ok) throw new Error('add failed');
    addTag(a.id, { code: 'x', groupId: 'g1', initial: 2 });
    const dup = store().duplicateEquipment(a.id);
    expect(dup.ok).toBe(true);
    const copy = store().equipments[1];
    expect(copy.id).not.toBe(a.id);
    expect(copy.craneId).toBe('A_2');
    expect(copy.groups[0].id).not.toBe('g1');
    expect(copy.tags[0].id).not.toBe(store().equipments[0].tags[0].id);
    expect(copy.tags[0].groupId).toBe(copy.groups[0].id);
    expect(virtualTagRuntime.getValue('A_2:x')).toBe(2);
    store().duplicateEquipment(a.id);
    expect(store().equipments[2].craneId).toBe('A_3');
    expect(store().duplicateEquipment('missing').ok).toBe(false);
  });
});

describe('그룹', () => {
  it('addGroup: 상한까지, 없는 장비는 no-equipment', () => {
    const a = addEquipment();
    const g = store().addGroup(a, ' 계측값 ', 'measurement');
    expect(g.ok).toBe(true);
    expect(store().equipments[0].groups[0]).toMatchObject({
      name: '계측값',
      preset: 'measurement',
    });
    for (let i = 1; i < VIRTUAL_EQUIPMENT_GROUPS_MAX; i++) {
      expect(store().addGroup(a, `g${i}`).ok).toBe(true);
    }
    expect(store().addGroup(a, 'more')).toEqual({ ok: false, reason: 'limit' });
    expect(store().addGroup('missing', 'x')).toEqual({
      ok: false,
      reason: 'no-equipment',
    });
  });

  it('updateGroup 은 이름만, removeGroup 은 그 그룹 태그를 미분류로', () => {
    const a = addEquipment();
    const g = store().addGroup(a, 'G');
    if (!g.ok) throw new Error('add failed');
    addTag(a, { code: 'x', groupId: g.id });
    expect(store().updateGroup(a, g.id, { name: 'renamed' })).toBe(true);
    expect(store().equipments[0].groups[0].name).toBe('renamed');
    expect(store().updateGroup(a, 'missing', { name: 'x' })).toBe(false);
    const before = store().equipments;
    store().removeGroup(a, 'missing');
    expect(store().equipments).toBe(before);
    store().removeGroup(a, g.id);
    expect(store().equipments[0].groups).toEqual([]);
    expect(store().equipments[0].tags[0]).not.toHaveProperty('groupId');
  });

  it('moveGroup 은 이웃과 자리를 바꾸고 끝에서는 false', () => {
    const a = addEquipment();
    const g1 = store().addGroup(a, 'g1');
    const g2 = store().addGroup(a, 'g2');
    if (!g1.ok || !g2.ok) throw new Error('add failed');
    expect(store().moveGroup(a, g1.id, -1)).toBe(false);
    expect(store().moveGroup(a, g1.id, 1)).toBe(true);
    expect(store().equipments[0].groups.map((g) => g.name)).toEqual([
      'g2',
      'g1',
    ]);
    expect(store().moveGroup(a, g1.id, 1)).toBe(false);
    expect(store().moveGroup(a, 'missing', 1)).toBe(false);
  });
});

describe('태그 CRUD', () => {
  it('추가하면 기본 패턴은 숫자 삼각파·불리언 수동이고, 그룹은 장비 그룹에 있을 때만', () => {
    const a = store().addEquipment({
      craneId: 'C_1',
      groups: [{ id: 'g1', name: 'G' }],
    });
    if (!a.ok) throw new Error('add failed');
    addTag(a.id, { code: ' x ', min: 0, max: 10, groupId: 'g1' });
    addTag(a.id, { code: 'b', dataType: 'bool', groupId: 'gone' });
    const [num, bool] = store().equipments[0].tags;
    expect(num).toMatchObject({
      code: 'x',
      dataType: 'number',
      min: 0,
      max: 10,
      enabled: true,
      groupId: 'g1',
    });
    expect(num.pattern.kind).toBe('triangle');
    expect(bool).toMatchObject({
      code: 'b',
      dataType: 'bool',
      min: 0,
      max: 1,
      pattern: { kind: 'manual' },
    });
    expect(bool).not.toHaveProperty('groupId');
    expect(store().entries.map((e) => e.key)).toEqual(['C_1:x', 'C_1:b']);
  });

  it('빈·공백·콜론 코드는 invalid-code, 중복은 duplicate-code, 없는 장비는 no-equipment', () => {
    const a = addEquipment();
    addTag(a, { code: 'x' });
    for (const code of ['  ', 'a b', 'a:b']) {
      expect(store().addTag(a, { code })).toEqual({
        ok: false,
        reason: 'invalid-code',
      });
    }
    expect(store().addTag(a, { code: 'x' })).toEqual({
      ok: false,
      reason: 'duplicate-code',
    });
    expect(store().addTag('missing', { code: 'x' })).toEqual({
      ok: false,
      reason: 'no-equipment',
    });
  });

  it('상한: 정확히 MAX 개까지, +1 은 limit', () => {
    const a = addEquipment();
    for (let i = 0; i < VIRTUAL_EQUIPMENT_TAGS_MAX; i++) {
      expect(store().addTag(a, { code: `k${i}` }).ok).toBe(true);
    }
    expect(store().addTag(a, { code: 'one-more' })).toEqual({
      ok: false,
      reason: 'limit',
    });
  });

  it('updateTag: 코드 중복·손상이면 false 이고 다른 필드도 적용하지 않는다', () => {
    const a = addEquipment();
    const x = addTag(a, { code: 'x' });
    addTag(a, { code: 'y' });
    const before = store().equipments;
    expect(store().updateTag(a, x, { code: 'y', name: 'renamed' })).toBe(false);
    expect(store().updateTag(a, x, { code: 'a:b', name: 'renamed' })).toBe(
      false,
    );
    expect(store().equipments).toBe(before);
    expect(
      store().updateTag(a, x, { code: 'x', name: 'renamed', max: 50 }),
    ).toBe(true);
    expect(store().equipments[0].tags[0]).toMatchObject({
      code: 'x',
      name: 'renamed',
      max: 50,
    });
    expect(store().updateTag(a, 'missing', { name: 'x' })).toBe(false);
    expect(store().updateTag('missing', x, { name: 'x' })).toBe(false);
  });

  it('updateTag: 범위를 줄이면 런타임 값이 새 범위로 다시 잡힌다', () => {
    const a = addEquipment('A');
    const x = addTag(a, {
      code: 'x',
      min: 0,
      max: 100,
      initial: 80,
      pattern: { kind: 'manual' },
    });
    expect(virtualTagRuntime.getValue('A:x')).toBe(80);
    store().updateTag(a, x, { max: 50 });
    expect(virtualTagRuntime.getValue('A:x')).toBe(50);
  });

  it('removeTag: 없는 id 는 참조 유지, 있으면 러너에서도 사라진다', () => {
    const a = addEquipment('A');
    const x = addTag(a, { code: 'x' });
    const before = store().equipments;
    store().removeTag(a, 'missing');
    expect(store().equipments).toBe(before);
    store().removeTag(a, x);
    expect(store().equipments[0].tags).toEqual([]);
    expect(virtualTagRuntime.getValue('A:x')).toBeUndefined();
  });

  it('duplicateTag 는 코드에 접미사를 붙여 복제한다', () => {
    const a = addEquipment();
    const x = addTag(a, { code: 'x', name: 'X', min: 1, max: 9 });
    expect(store().duplicateTag(a, x).ok).toBe(true);
    expect(store().equipments[0].tags[1]).toMatchObject({
      code: 'x_2',
      name: 'X',
      min: 1,
      max: 9,
    });
    store().duplicateTag(a, x);
    expect(store().equipments[0].tags[2].code).toBe('x_3');
    expect(store().duplicateTag(a, 'missing').ok).toBe(false);
    expect(store().duplicateTag('missing', x).ok).toBe(false);
  });

  it('importTags: 없는 그룹만 붙이고, 코드 중복·손상은 건너뛰며 수를 돌려준다', () => {
    const a = store().addEquipment({
      craneId: 'C_1',
      groups: [{ id: 'g-m', name: '계측값', preset: 'measurement' }],
    });
    if (!a.ok) throw new Error('add failed');
    addTag(a.id, { code: 'dup' });
    const result = store().importTags(a.id, {
      groups: [
        { id: 'g-m', name: 'again', preset: 'measurement' },
        { id: 'g-s', name: '상태', preset: 'status' },
      ],
      tags: [
        tagDef('t1', 'dup'),
        tagDef('t2', 'fresh', { groupId: 'g-s' }),
        tagDef('t3', 'orphan', { groupId: 'nope' }),
        { id: 'bad' } as unknown as VirtualTagDefinition,
      ],
    });
    expect(result).toEqual({ added: 2, skipped: 2 });
    const equipment = store().equipments[0];
    expect(equipment.groups.map((g) => g.name)).toEqual(['계측값', '상태']);
    expect(equipment.tags.map((t) => t.code)).toEqual([
      'dup',
      'fresh',
      'orphan',
    ]);
    expect(equipment.tags[1].groupId).toBe('g-s');
    expect(equipment.tags[2]).not.toHaveProperty('groupId');
    expect(store().importTags('missing', { tags: [tagDef('t', 'x')] })).toEqual(
      {
        added: 0,
        skipped: 1,
      },
    );
  });

  it('setTickMs 는 클램프하고 같은 값이면 상태 참조를 유지한다', () => {
    store().setTickMs(5);
    expect(store().tickMs).toBe(16);
    const before = useVirtualTagStore.getState();
    store().setTickMs(16);
    expect(useVirtualTagStore.getState()).toBe(before);
  });
});

describe('재생(runner)', () => {
  it('start 시 현재값을 즉시 내보내고, 틱마다 파형을 진행한다', () => {
    const a = addEquipment('A');
    addTag(a, {
      code: 'tri',
      min: 0,
      max: 100,
      initial: 0,
      pattern: { kind: 'triangle', periodMs: 1000 },
    });
    addTag(a, { code: 'off', enabled: false });
    store().start();
    expect(store().isRunning).toBe(true);
    expect(received.get('A:tri')).toEqual([0]);
    expect(received.has('A:off')).toBe(false);

    vi.advanceTimersByTime(250);
    const values = received.get('A:tri') ?? [];
    expect(values.length).toBe(1 + 2);
    expect(values[values.length - 1]).toBeCloseTo(40, 6);
    expect(tagLiveValues.get('A:tri')?.value).toBeCloseTo(40, 6);
  });

  it('pause 후에는 틱이 멈추고, 재개하면 위상이 이어진다', () => {
    const a = addEquipment('A');
    addTag(a, {
      code: 'saw',
      min: 0,
      max: 100,
      pattern: { kind: 'sawtooth', periodMs: 1000 },
    });
    store().start();
    vi.advanceTimersByTime(300);
    store().pause();
    expect(store().isRunning).toBe(false);
    const countAtPause = received.get('A:saw')?.length ?? 0;
    vi.advanceTimersByTime(1000);
    expect(received.get('A:saw')?.length).toBe(countAtPause);

    store().start();
    vi.advanceTimersByTime(100);
    const values = received.get('A:saw') ?? [];
    // 재개 직후 publishAll(30) → 다음 틱 40: 멈춘 동안의 시간은 흐르지 않는다.
    expect(values[values.length - 1]).toBeCloseTo(40, 6);
  });

  it('start 는 멱등이고, 코드를 바꾸면 다음 틱부터 새 키로 나간다', () => {
    const a = addEquipment('A');
    const x = addTag(a, {
      code: 'x',
      min: 0,
      max: 10,
      pattern: { kind: 'manual' },
      initial: 3,
    });
    store().start();
    store().start();
    vi.advanceTimersByTime(100);
    expect(received.get('A:x')).toEqual([3, 3]);
    store().updateTag(a, x, { code: 'renamed' });
    vi.advanceTimersByTime(100);
    expect(received.get('A:renamed')).toEqual([3]);
  });

  it('장비를 끄면 그 장비 태그가 다음 틱부터 나가지 않는다', () => {
    const a = addEquipment('A');
    addTag(a, { code: 'x', pattern: { kind: 'manual' }, initial: 3 });
    store().start();
    vi.advanceTimersByTime(100);
    const count = received.get('A:x')!.length;
    store().updateEquipment(a, { enabled: false });
    vi.advanceTimersByTime(300);
    expect(received.get('A:x')!.length).toBe(count);
  });

  it('manual 값 설정은 재생 중이 아니어도 즉시 내보내고 클램프한다', () => {
    const a = addEquipment('A');
    addTag(a, { code: 'x', min: 0, max: 10, pattern: { kind: 'manual' } });
    virtualTagRuntime.setManualValue('A:x', 99);
    expect(received.get('A:x')).toEqual([10]);
    expect(virtualTagRuntime.getValue('A:x')).toBe(10);
    virtualTagRuntime.setManualValue('missing', 1);
    expect(received.size).toBe(1);
  });

  it('resetValues 는 initial 로 되돌리고 파형 위상을 0 으로', () => {
    const a = addEquipment('A');
    addTag(a, {
      code: 'saw',
      min: 0,
      max: 100,
      pattern: { kind: 'sawtooth', periodMs: 1000 },
    });
    store().start();
    vi.advanceTimersByTime(500);
    virtualTagRuntime.resetValues();
    expect(virtualTagRuntime.getValue('A:saw')).toBe(0);
    vi.advanceTimersByTime(100);
    expect(virtualTagRuntime.getValue('A:saw')).toBeCloseTo(10, 6);
  });
});

describe('discard', () => {
  it('추가·틱 변경을 마지막 저장 스냅샷으로 되돌리고 러너 정의도 지운다', async () => {
    await store().load();
    const a = addEquipment('GC_04');
    addTag(a, { code: 'gantry', initial: 7 });
    store().setTickMs(250);
    expect(store().isDirty()).toBe(true);
    expect(virtualTagRuntime.getValue('GC_04:gantry')).toBe(7);

    store().discard();

    expect(store().equipments).toEqual([]);
    expect(store().entries).toEqual([]);
    expect(store().tickMs).toBe(100);
    expect(store().isDirty()).toBe(false);
    expect(virtualTagRuntime.getValue('GC_04:gantry')).toBeUndefined();
  });

  it('저장된 태그를 수정·삭제한 뒤 discard 하면 저장본과 러너 값이 돌아온다', async () => {
    const loaded: VirtualTagSet = {
      version: 2,
      tickMs: 100,
      equipments: [
        {
          id: 'e',
          craneId: 'GC_04',
          enabled: true,
          groups: [],
          tags: [
            tagDef('a', 'a', { name: 'A', initial: 3 }),
            tagDef('b', 'b', { name: 'B', initial: 5 }),
          ],
        },
      ],
    };
    storage.load.mockResolvedValue(loaded);
    await store().load();
    expect(store().updateTag('e', 'a', { initial: 9, code: 'renamed' })).toBe(
      true,
    );
    store().removeTag('e', 'b');
    expect(store().equipments[0].tags).toHaveLength(1);

    store().discard();

    expect(store().equipments).toEqual(loaded.equipments);
    expect(store().isDirty()).toBe(false);
    expect(virtualTagRuntime.getValue('GC_04:a')).toBe(3);
    expect(virtualTagRuntime.getValue('GC_04:b')).toBe(5);
    expect(virtualTagRuntime.getValue('GC_04:renamed')).toBeUndefined();
  });

  it('dirty 아니면 no-op — equipments 참조를 유지한다', async () => {
    await store().load();
    const before = store().equipments;
    store().discard();
    expect(store().equipments).toBe(before);
  });

  it('save 실패 뒤 discard 하면 편집본이 아니라 마지막 성공 저장본으로 돌아간다', async () => {
    await store().load();
    addEquipment('GC_04');
    storage.save.mockRejectedValueOnce(new Error('offline'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await store().save()).toBe(false);
    spy.mockRestore();
    expect(store().isDirty()).toBe(true);

    store().discard();

    expect(store().equipments).toEqual([]);
    expect(store().isDirty()).toBe(false);
  });
});
