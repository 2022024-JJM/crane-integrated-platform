// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedModelInfo, SavedSceneInfo } from '@crane/domain/3d';
import {
  SCENARIO_TAGS_MAX,
  SCENARIOS_MAX,
  scenarioTagKey,
  type ScenarioSet,
  type ScenarioTag,
  type SimulationScenario,
} from '@crane/domain/virtual-tag';
import {
  resetScenarioLoadState,
  scenariosOfSceneFile,
  useScenarioStore,
} from '../use-scenario-store';
import { virtualTagRuntime } from '../virtual-tag-runner';
import { setTagIngest, tagLiveValues } from '../tag-value-bus';

/**
 * 영속화 어댑터(scenario-storage)는 도메인에서 따로 테스트한다 — 여기서는
 * mock 으로 "무엇을 넘기고 결과를 어떻게 반영하는가" 만 본다.
 */
const storage = vi.hoisted(() => ({
  load: vi.fn<() => Promise<ScenarioSet>>(),
  save: vi.fn<(set: ScenarioSet) => Promise<ScenarioSet>>(),
}));

vi.mock('@crane/domain/virtual-tag', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@crane/domain/virtual-tag')>();
  return {
    ...actual,
    loadScenarioSet: storage.load,
    saveScenarioSet: storage.save,
  };
});

const received = new Map<string, number[]>();
const EMPTY: ScenarioSet = { version: 1, tickSec: 0.1, scenarios: [] };
const SCENE_FILE = 'test.json';

function model(id: string, craneId: string, codes: string[]): SavedModelInfo {
  return {
    id,
    equipName: id.toUpperCase(),
    craneId,
    path: '/m.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    tagMappings: codes.map((code, i) => ({
      id: `map-${id}-${i}`,
      target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
      code,
    })),
  };
}

const SCENE: SavedSceneInfo = {
  maps: [],
  texts: [],
  models: [model('mA', 'A', ['x', 'tri', 'saw']), model('mB', 'B', ['y'])],
} as unknown as SavedSceneInfo;

function tagDef(
  modelId: string,
  code: string,
  patch: Partial<Omit<ScenarioTag, 'id'>> = {},
): Omit<ScenarioTag, 'id'> {
  return {
    modelId,
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

function savedScenario(
  id: string,
  tags: ScenarioTag[],
  sceneFile = SCENE_FILE,
): SimulationScenario {
  return { id, name: id.toUpperCase(), sceneFile, tags };
}

function reset() {
  useScenarioStore.getState().pause();
  useScenarioStore.setState({
    scenarios: [],
    activeScenarioId: null,
    sceneInfo: SCENE,
    sceneFile: SCENE_FILE,
    entries: [],
    issues: [],
    tickSec: 0.1,
    speed: 1,
    hasSession: false,
    savedSnapshot: JSON.stringify(EMPTY),
    hydrated: false,
    isSaving: false,
    isRunning: false,
  });
  resetScenarioLoadState();
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

const store = () => useScenarioStore.getState();
const key = (modelId: string, code: string) =>
  scenarioTagKey({ modelId, code });

/** 시나리오 하나를 만들고 id 를 돌려준다(실패하면 throw). */
function addScenario(
  name = 'S',
  tags: Omit<ScenarioTag, 'id'>[] = [],
  sceneFile = SCENE_FILE,
): string {
  const result = store().addScenario({ name, sceneFile, tags });
  if (!result.ok) throw new Error(`addScenario failed: ${result.reason}`);
  return result.id;
}

describe('load / save / isDirty', () => {
  it('load 는 한 번만 읽고 스냅샷·활성·평탄 목록·러너를 채운다 — 직후는 dirty 아님', async () => {
    const loaded: ScenarioSet = {
      version: 1,
      tickSec: 0.25,
      scenarios: [
        savedScenario('s', [{ ...tagDef('mA', 'x', { initial: 5 }), id: 'a' }]),
      ],
    };
    storage.load.mockResolvedValue(loaded);
    await Promise.all([store().load(), store().load()]);
    await store().load();
    expect(storage.load).toHaveBeenCalledTimes(1);
    expect(store().scenarios.map((s) => s.id)).toEqual(['s']);
    expect(store().activeScenarioId).toBe('s');
    expect(store().entries.map((e) => e.key)).toEqual(['A.x']);
    expect(store().tickSec).toBe(0.25);
    expect(store().isDirty()).toBe(false);
    expect(virtualTagRuntime.getValue('A.x')).toBe(5);
  });

  it('load 실패는 빈 세트로 시작하되 hydrated 를 세운다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.load.mockRejectedValue(new Error('404'));
    await store().load();
    expect(store().hydrated).toBe(true);
    expect(store().scenarios).toEqual([]);
  });

  it('편집은 저장하지 않고 dirty 만 세운다. save 가 버전 1 세트를 넘기고 스냅샷을 갱신한다', async () => {
    await store().load();
    addScenario();
    expect(storage.save).not.toHaveBeenCalled();
    expect(store().isDirty()).toBe(true);
    expect(await store().save()).toBe(true);
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1, tickSec: 0.1 }),
    );
    expect(store().isDirty()).toBe(false);
    store().setTickSec(0.2);
    expect(store().isDirty()).toBe(true);
  });

  it('save 응답(정규화된 세트)을 상태에 반영한다', async () => {
    addScenario();
    storage.save.mockImplementation((set) =>
      Promise.resolve({ ...set, tickSec: 0.016 }),
    );
    await store().save();
    expect(store().tickSec).toBe(0.016);
    expect(store().isDirty()).toBe(false);
  });

  it('save 실패는 false 이고 메모리 상태·dirty 를 유지한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    addScenario();
    storage.save.mockRejectedValue(new Error('500'));
    expect(await store().save()).toBe(false);
    expect(store().scenarios).toHaveLength(1);
    expect(store().isDirty()).toBe(true);
    expect(store().isSaving).toBe(false);
  });
});

describe('씬 붙이기·활성 시나리오', () => {
  it('attachScene 은 그 씬 파일의 시나리오만 활성 후보로 — 없으면 null', () => {
    addScenario('other', [], 'other.json');
    const mine = addScenario('mine');
    expect(store().activeScenarioId).toBe(mine);
    expect(
      scenariosOfSceneFile(store().scenarios, SCENE_FILE).map((s) => s.id),
    ).toEqual([mine]);
    store().attachScene(SCENE, 'other.json');
    expect(store().activeScenarioId).toBe(store().scenarios[0].id);
    store().attachScene(null, null);
    expect(store().activeScenarioId).toBeNull();
    expect(store().entries).toEqual([]);
  });

  it('같은 씬·파일을 다시 붙이면 참조를 유지한다(no-op)', () => {
    addScenario();
    const before = store();
    store().attachScene(SCENE, SCENE_FILE);
    expect(useScenarioStore.getState()).toBe(before);
  });

  it('씬을 바꾸면 entries 를 다시 파생한다 — 모델이 사라지면 issue', () => {
    addScenario('S', [tagDef('mA', 'x'), tagDef('mB', 'y')]);
    expect(store().entries.map((e) => e.key)).toEqual(['A.x', 'B.y']);
    store().attachScene(
      { ...SCENE, models: [model('mA', 'A2', ['x'])] } as SavedSceneInfo,
      SCENE_FILE,
    );
    expect(store().entries.map((e) => e.key)).toEqual(['A2.x']);
    expect(store().issues.map((i) => i.reason)).toEqual(['model-missing']);
  });

  it('setActiveScenario: 없는 id 는 그 파일의 첫 것으로, 같은 값은 no-op', () => {
    const a = addScenario('A');
    const b = addScenario('B');
    expect(store().activeScenarioId).toBe(b);
    store().setActiveScenario(a);
    expect(store().activeScenarioId).toBe(a);
    const before = store();
    store().setActiveScenario(a);
    expect(useScenarioStore.getState()).toBe(before);
    store().setActiveScenario('ghost');
    expect(store().activeScenarioId).toBe(a);
  });
});

describe('시나리오 CRUD', () => {
  it('추가는 이름을 trim 하고 활성으로 만든다. 빈 이름은 invalid-name, 상한은 limit', () => {
    const id = addScenario('  횡행 중 고장  ');
    expect(store().scenarios[0].name).toBe('횡행 중 고장');
    expect(store().activeScenarioId).toBe(id);
    expect(store().addScenario({ name: '   ', sceneFile: SCENE_FILE })).toEqual(
      {
        ok: false,
        reason: 'invalid-name',
      },
    );
    for (let i = store().scenarios.length; i < SCENARIOS_MAX; i++) {
      addScenario(`s${i}`);
    }
    expect(store().addScenario({ name: 'x', sceneFile: SCENE_FILE })).toEqual({
      ok: false,
      reason: 'limit',
    });
  });

  it('추가 때 받은 태그는 id 를 받고 (modelId, code) 중복은 걸러진다', () => {
    const id = addScenario('S', [
      tagDef('mA', 'x', { initial: 3 }),
      tagDef('mA', 'x', { initial: 9 }),
      tagDef('mB', 'y'),
    ]);
    const scenario = store().scenarios.find((s) => s.id === id)!;
    expect(scenario.tags.map((t) => [t.modelId, t.code])).toEqual([
      ['mA', 'x'],
      ['mB', 'y'],
    ]);
    expect(scenario.tags.every((t) => typeof t.id === 'string' && t.id)).toBe(
      true,
    );
    expect(virtualTagRuntime.getValue('A.x')).toBe(3);
  });

  it('renameScenario: trim·길이 제한, 빈 이름·없는 id 는 false, 같은 이름은 참조 유지', () => {
    const id = addScenario('S');
    expect(store().renameScenario(id, '  T  ')).toBe(true);
    expect(store().scenarios[0].name).toBe('T');
    expect(store().renameScenario(id, '   ')).toBe(false);
    expect(store().renameScenario('ghost', 'x')).toBe(false);
    const before = store().scenarios;
    store().renameScenario(id, 'T');
    expect(store().scenarios).toBe(before);
  });

  it('removeScenario: 없는 id 는 참조 유지, 활성을 지우면 같은 파일의 다음 것으로', () => {
    const a = addScenario('A');
    const b = addScenario('B');
    const before = store().scenarios;
    store().removeScenario('ghost');
    expect(store().scenarios).toBe(before);
    store().setActiveScenario(b);
    store().removeScenario(b);
    expect(store().activeScenarioId).toBe(a);
    store().removeScenario(a);
    expect(store().activeScenarioId).toBeNull();
    expect(store().entries).toEqual([]);
  });

  it('duplicateScenario: 새 id·접미사 이름, 태그도 새 id 로, 복제본이 활성', () => {
    const id = addScenario('S', [tagDef('mA', 'x')]);
    const result = store().duplicateScenario(id);
    expect(result.ok).toBe(true);
    const copy = store().scenarios[1];
    expect(copy.id).not.toBe(id);
    expect(copy.name).toBe('S 2');
    expect(copy.tags[0].id).not.toBe(store().scenarios[0].tags[0].id);
    expect(copy.tags[0].code).toBe('x');
    expect(store().activeScenarioId).toBe(copy.id);
    expect(store().duplicateScenario('ghost').ok).toBe(false);
  });
});

describe('태그 CRUD', () => {
  it('addTags: 중복·손상은 건너뛰고 수를 돌려주며 러너에 반영된다', () => {
    const id = addScenario('S', [tagDef('mA', 'x')]);
    const result = store().addTags(id, [
      tagDef('mA', 'x'), // 중복
      tagDef('mA', 'tri', { pattern: { kind: 'triangle', periodSec: 1 } }),
      { ...tagDef('mB', 'y'), modelId: '' }, // 손상
    ]);
    expect(result).toEqual({ added: 1, skipped: 2 });
    expect(store().entries.map((e) => e.key)).toEqual(['A.x', 'A.tri']);
    expect(store().addTags('ghost', [tagDef('mA', 'x')])).toEqual({
      added: 0,
      skipped: 1,
    });
  });

  it('addTags 상한: 정확히 MAX 개까지, +1 은 건너뛴다', () => {
    const id = addScenario('S');
    const many = Array.from({ length: SCENARIO_TAGS_MAX + 1 }, (_, i) =>
      tagDef('mA', `k${i}`),
    );
    expect(store().addTags(id, many)).toEqual({
      added: SCENARIO_TAGS_MAX,
      skipped: 1,
    });
  });

  it('updateTag: modelId·code 는 바꿀 수 없고, 손상이면 false 이고 적용하지 않는다', () => {
    const id = addScenario('S', [tagDef('mA', 'x', { initial: 3 })]);
    const tagId = store().scenarios[0].tags[0].id;
    expect(store().updateTag(id, tagId, { initial: 9, name: 'N' })).toBe(true);
    expect(store().scenarios[0].tags[0]).toMatchObject({
      initial: 9,
      name: 'N',
    });
    expect(
      store().updateTag(id, tagId, {
        modelId: 'mB',
        code: 'y',
      } as Partial<ScenarioTag>),
    ).toBe(true);
    expect(store().scenarios[0].tags[0]).toMatchObject({
      modelId: 'mA',
      code: 'x',
    });
    expect(store().updateTag(id, 'ghost', { initial: 1 })).toBe(false);
    expect(store().updateTag('ghost', tagId, { initial: 1 })).toBe(false);
  });

  it('updateTag: 범위를 줄이면 런타임 값이 새 범위로 다시 잡힌다', () => {
    const id = addScenario('S', [tagDef('mA', 'x', { max: 100 })]);
    const tagId = store().scenarios[0].tags[0].id;
    virtualTagRuntime.setManualValue('A.x', 50);
    store().updateTag(id, tagId, { max: 10 });
    expect(virtualTagRuntime.getValue('A.x')).toBe(0);
  });

  it('removeModelTags: 없는 모델은 참조 유지, 있으면 그 모델 태그가 러너에서도 사라진다', () => {
    const id = addScenario('S', [
      tagDef('mA', 'x'),
      tagDef('mA', 'tri'),
      tagDef('mB', 'y'),
    ]);
    const before = store().scenarios;
    store().removeModelTags(id, 'ghost');
    expect(store().scenarios).toBe(before);
    store().removeModelTags(id, 'mA');
    expect(virtualTagRuntime.getValue('A.x')).toBeUndefined();
    expect(store().entries.map((e) => e.key)).toEqual(['B.y']);
  });

  it('editTags: 키로 지우고 새 태그를 넣는 것을 commit 한 번에 — 남는 태그 정의는 그대로', () => {
    const id = addScenario('S', [
      tagDef('mA', 'x', { unit: 'mm', max: 42 }),
      tagDef('mA', 'tri'),
      tagDef('mB', 'y'),
    ]);
    const before = store().scenarios;
    const commits: number[] = [];
    const unsubscribe = useScenarioStore.subscribe((state, prev) => {
      if (state.scenarios !== prev.scenarios) commits.push(1);
    });
    const result = store().editTags(id, {
      add: [tagDef('mA', 'saw'), tagDef('mB', 'y')], // mB.y 는 이미 있음
      removeKeys: [key('mA', 'tri'), key('ghost', 'nope')],
    });
    unsubscribe();
    expect(result).toEqual({ added: 1, removed: 1, skipped: 1 });
    expect(commits).toHaveLength(1);
    expect(store().scenarios).not.toBe(before);
    const tags = store().scenarios[0].tags;
    expect(tags.map((t) => t.code)).toEqual(['x', 'y', 'saw']);
    expect(tags[0]).toMatchObject({ unit: 'mm', max: 42 });
    expect(store().entries.map((e) => e.key)).toEqual(['A.x', 'B.y', 'A.saw']);
    expect(virtualTagRuntime.getValue('A.tri')).toBeUndefined();
  });

  it('editTags: 지울 것도 넣을 것도 없으면 참조 유지, 없는 시나리오는 전부 skipped', () => {
    const id = addScenario('S', [tagDef('mA', 'x')]);
    const before = store().scenarios;
    expect(
      store().editTags(id, {
        add: [tagDef('mA', 'x')],
        removeKeys: [key('ghost', 'nope')],
      }),
    ).toEqual({ added: 0, removed: 0, skipped: 1 });
    expect(store().scenarios).toBe(before);
    expect(
      store().editTags('ghost', { add: [tagDef('mA', 'x')], removeKeys: [] }),
    ).toEqual({ added: 0, removed: 0, skipped: 1 });
    expect(store().scenarios).toBe(before);
  });

  it('editTags: 지운 자리만큼 상한 안에서 다시 넣을 수 있다', () => {
    const id = addScenario('S');
    store().addTags(
      id,
      Array.from({ length: SCENARIO_TAGS_MAX }, (_, i) =>
        tagDef('mA', `k${i}`),
      ),
    );
    expect(
      store().editTags(id, {
        add: [tagDef('mA', 'new1'), tagDef('mA', 'new2')],
        removeKeys: [key('mA', 'k0')],
      }),
    ).toEqual({ added: 1, removed: 1, skipped: 1 });
    expect(store().scenarios[0].tags).toHaveLength(SCENARIO_TAGS_MAX);
  });

  it('setTickSec 는 클램프하고 같은 값이면 상태 참조를 유지한다', () => {
    store().setTickSec(99);
    expect(store().tickSec).toBe(5);
    const before = useScenarioStore.getState();
    store().setTickSec(5);
    expect(useScenarioStore.getState()).toBe(before);
  });
});

describe('재생(runner)', () => {
  it('start 시 현재값을 즉시 내보내고, 틱마다 파형을 진행한다', () => {
    addScenario('S', [
      tagDef('mA', 'tri', {
        max: 100,
        pattern: { kind: 'triangle', periodSec: 1 },
      }),
    ]);
    store().start();
    expect(store().isRunning).toBe(true);
    expect(received.get('A.tri')).toEqual([0]);

    vi.advanceTimersByTime(250);
    const values = received.get('A.tri') ?? [];
    expect(values.length).toBe(1 + 2);
    expect(values[values.length - 1]).toBeCloseTo(40, 6);
    expect(tagLiveValues.get('A.tri')?.value).toBeCloseTo(40, 6);
  });

  it('pause 후에는 틱이 멈추고, 재개하면 위상이 이어진다', () => {
    addScenario('S', [
      tagDef('mA', 'saw', {
        max: 100,
        pattern: { kind: 'sawtooth', periodSec: 1 },
      }),
    ]);
    store().start();
    vi.advanceTimersByTime(300);
    store().pause();
    expect(store().isRunning).toBe(false);
    const countAtPause = received.get('A.saw')?.length ?? 0;
    vi.advanceTimersByTime(1000);
    expect(received.get('A.saw')?.length).toBe(countAtPause);

    store().start();
    vi.advanceTimersByTime(100);
    const values = received.get('A.saw') ?? [];
    // 재개 직후 publishAll(30) → 다음 틱 40: 멈춘 동안의 시간은 흐르지 않는다.
    expect(values[values.length - 1]).toBeCloseTo(40, 6);
  });

  it('start 는 멱등이고, 태그를 빼면 다음 틱부터 그 키가 나가지 않는다', () => {
    const id = addScenario('S', [tagDef('mA', 'x', { initial: 3 })]);
    store().start();
    store().start();
    vi.advanceTimersByTime(100);
    expect(received.get('A.x')).toEqual([3, 3]);
    store().editTags(id, { add: [], removeKeys: [key('mA', 'x')] });
    vi.advanceTimersByTime(300);
    expect(received.get('A.x')).toEqual([3, 3]);
  });

  it('manual 값 설정은 재생 중이 아니어도 즉시 내보내고 클램프한다', () => {
    addScenario('S', [tagDef('mA', 'x', { max: 10 })]);
    virtualTagRuntime.setManualValue('A.x', 99);
    expect(received.get('A.x')).toEqual([10]);
    expect(virtualTagRuntime.getValue('A.x')).toBe(10);
    virtualTagRuntime.setManualValue('missing', 1);
    expect(received.size).toBe(1);
  });

  it('resetValues 는 initial 로 되돌리고 파형 위상을 0 으로', () => {
    addScenario('S', [
      tagDef('mA', 'saw', {
        max: 100,
        pattern: { kind: 'sawtooth', periodSec: 1 },
      }),
    ]);
    store().start();
    vi.advanceTimersByTime(500);
    virtualTagRuntime.resetValues();
    expect(virtualTagRuntime.getValue('A.saw')).toBe(0);
    vi.advanceTimersByTime(100);
    expect(virtualTagRuntime.getValue('A.saw')).toBeCloseTo(10, 6);
  });
});

describe('discard', () => {
  it('추가·틱 변경을 마지막 저장 스냅샷으로 되돌리고 러너 정의도 지운다', async () => {
    await store().load();
    addScenario('S', [tagDef('mA', 'x', { initial: 7 })]);
    store().setTickSec(0.25);
    expect(store().isDirty()).toBe(true);
    expect(virtualTagRuntime.getValue('A.x')).toBe(7);

    store().discard();

    expect(store().scenarios).toEqual([]);
    expect(store().entries).toEqual([]);
    expect(store().activeScenarioId).toBeNull();
    expect(store().tickSec).toBe(0.1);
    expect(store().isDirty()).toBe(false);
    expect(virtualTagRuntime.getValue('A.x')).toBeUndefined();
  });

  it('저장된 태그를 수정·삭제한 뒤 discard 하면 저장본과 러너 값이 돌아온다', async () => {
    const loaded: ScenarioSet = {
      version: 1,
      tickSec: 0.1,
      scenarios: [
        savedScenario('s', [
          { ...tagDef('mA', 'x', { name: 'A', initial: 3 }), id: 'a' },
          { ...tagDef('mB', 'y', { name: 'B', initial: 5 }), id: 'b' },
        ]),
      ],
    };
    storage.load.mockResolvedValue(loaded);
    await store().load();
    expect(store().updateTag('s', 'a', { initial: 9 })).toBe(true);
    store().editTags('s', { add: [], removeKeys: [key('mB', 'y')] });
    expect(store().scenarios[0].tags).toHaveLength(1);

    store().discard();

    expect(store().scenarios).toEqual(loaded.scenarios);
    expect(store().isDirty()).toBe(false);
    expect(virtualTagRuntime.getValue('A.x')).toBe(3);
    expect(virtualTagRuntime.getValue('B.y')).toBe(5);
  });

  it('dirty 아니면 no-op — scenarios 참조를 유지한다', async () => {
    await store().load();
    const before = store().scenarios;
    store().discard();
    expect(store().scenarios).toBe(before);
  });

  it('save 실패 뒤 discard 하면 편집본이 아니라 마지막 성공 저장본으로 돌아간다', async () => {
    await store().load();
    addScenario('S');
    storage.save.mockRejectedValueOnce(new Error('offline'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await store().save()).toBe(false);
    spy.mockRestore();
    expect(store().isDirty()).toBe(true);

    store().discard();

    expect(store().scenarios).toEqual([]);
    expect(store().isDirty()).toBe(false);
  });
});
