import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { SimulationScenario } from '@crane/domain/virtual-tag';
import {
  buildScenarioTags,
  countSelection,
  diffPickSelection,
  existingPickKeys,
  filterModelsNotInScenario,
  filterPickableModels,
  listPickableModels,
  modelPickKeys,
  pickKey,
} from '../scenario-pick';

const node = (axis: 'x' | 'z') =>
  ({ kind: 'node', node: '', channel: 'position', axis }) as const;

const scene = {
  models: [
    {
      id: 'm1',
      equipName: 'GC-04',
      craneId: 'GC_04',
      tagMappings: [
        { id: 'a', code: 'gantry', target: node('z') },
        { id: 'b', code: 'trolley', target: node('x') },
      ],
      statusTags: { fault: 'err' },
    },
    { id: 'm2', equipName: 'Plain', tagMappings: [] },
    {
      id: 'm3',
      equipName: 'LLC-002',
      tagMappings: [
        { id: 'c', code: 'luff', target: { kind: 'joint', jointId: 'j' } },
      ],
    },
  ],
} as unknown as SavedSceneInfo;

const models = listPickableModels(scene);

/** 선택 키(`scenarioTagKey`)를 최소 태그로 — filterModelsNotInScenario 입력용. */
function keyToTag(key: string) {
  const [modelId, code] = key.split('\u0000');
  return { modelId, code } as SimulationScenario['tags'][number];
}

describe('listPickableModels', () => {
  it('씬이 없으면 빈 배열', () => {
    expect(listPickableModels(null)).toEqual([]);
  });

  it('맵핑·상태 태그가 하나라도 있는 모델만, 씬 순서, 크레인은 없을 수 있다', () => {
    expect(models.map((m) => m.modelId)).toEqual(['m1', 'm3']);
    expect(models[0]).toMatchObject({ equipName: 'GC-04', craneId: 'GC_04' });
    expect(models[0].codes.map((c) => c.code)).toEqual([
      'gantry',
      'trolley',
      'err',
    ]);
    expect(models[1].craneId).toBeUndefined();
  });

  it('선택 키는 (modelId, code) 이고 모델 키 목록은 코드 순', () => {
    expect(modelPickKeys(models[0])).toEqual([
      pickKey('m1', 'gantry'),
      pickKey('m1', 'trolley'),
      pickKey('m1', 'err'),
    ]);
    expect(pickKey('m1', 'a')).not.toBe(pickKey('m2', 'a'));
  });
});

describe('filterPickableModels', () => {
  it('빈 검색어는 전부(새 배열)', () => {
    const out = filterPickableModels(models, '  ');
    expect(out).toEqual(models);
    expect(out).not.toBe(models);
  });

  it('모델 이름·크레인에 맞으면 코드 전부, 코드에만 맞으면 그 코드만', () => {
    expect(filterPickableModels(models, 'gc-04')[0].codes).toHaveLength(3);
    expect(filterPickableModels(models, 'GC_04')[0].codes).toHaveLength(3);
    const byCode = filterPickableModels(models, 'LUFF');
    expect(byCode).toHaveLength(1);
    expect(byCode[0].codes.map((c) => c.code)).toEqual(['luff']);
  });

  it('맞는 것이 없으면 빈 배열', () => {
    expect(filterPickableModels(models, 'nothing')).toEqual([]);
  });
});

describe('existingPickKeys · buildScenarioTags · countSelection', () => {
  const existing = existingPickKeys({
    tags: [
      {
        id: 't',
        modelId: 'm1',
        code: 'gantry',
        name: '',
        dataType: 'number',
        min: 0,
        max: 1,
        initial: 0,
        pattern: { kind: 'manual' },
      },
    ],
  });

  it('없는 시나리오는 빈 집합', () => {
    expect(existingPickKeys(null).size).toBe(0);
    expect(existing.has(pickKey('m1', 'gantry'))).toBe(true);
  });

  it('선택 순서와 무관하게 모델 순 › 코드 순', () => {
    const selected = new Set([
      pickKey('m3', 'luff'),
      pickKey('m1', 'err'),
      pickKey('m1', 'gantry'),
      pickKey('m1', 'trolley'),
    ]);
    const tags = buildScenarioTags(selected, models);
    expect(tags.map((t) => `${t.modelId}:${t.code}`)).toEqual([
      'm1:gantry',
      'm1:trolley',
      'm1:err',
      'm3:luff',
    ]);
  });

  it('기본값 — 상태 태그는 불리언, 맵핑은 숫자 0~100·수동, id 는 없다', () => {
    const [trolley, err] = buildScenarioTags(
      new Set([pickKey('m1', 'trolley'), pickKey('m1', 'err')]),
      models,
    );
    expect(trolley).toMatchObject({
      modelId: 'm1',
      code: 'trolley',
      dataType: 'number',
      min: 0,
      max: 100,
      initial: 0,
      pattern: { kind: 'manual' },
    });
    expect(err).toMatchObject({ dataType: 'bool', min: 0, max: 1 });
    expect('id' in trolley).toBe(false);
  });

  it('빈 선택·모르는 키는 빈 결과', () => {
    expect(buildScenarioTags(new Set(), models)).toEqual([]);
    expect(buildScenarioTags(new Set([pickKey('zz', 'x')]), models)).toEqual(
      [],
    );
  });

  it('요약은 선택된 태그가 있는 모델 수와 태그 수 — 모르는 키는 세지 않는다', () => {
    const selected = new Set([
      pickKey('m1', 'gantry'),
      pickKey('m1', 'err'),
      pickKey('m3', 'luff'),
      pickKey('zz', 'x'),
    ]);
    expect(countSelection(selected, models)).toEqual({ models: 2, tags: 3 });
    expect(countSelection(new Set(), models)).toEqual({ models: 0, tags: 0 });
  });

  it('filterModelsNotInScenario: 시나리오에 태그가 하나라도 있는 모델은 빠진다', () => {
    expect(
      filterModelsNotInScenario(models, { tags: [...existing].map(keyToTag) }),
    ).toEqual([models[1]]);
    expect(filterModelsNotInScenario(models, null)).toEqual(models);
    expect(filterModelsNotInScenario(models, { tags: [] })).toEqual(models);
  });
});

describe('diffPickSelection', () => {
  const m1Keys = modelPickKeys(models[0]); // gantry · trolley · err
  const existing = new Set([pickKey('m1', 'gantry'), pickKey('m1', 'err')]);

  it('범위 순으로 새로 체크한 키는 add, 풀린 키는 remove, 그대로는 어느 쪽도 아니다', () => {
    const selected = new Set([pickKey('m1', 'trolley'), pickKey('m1', 'err')]);
    expect(diffPickSelection(selected, existing, m1Keys)).toEqual({
      addKeys: [pickKey('m1', 'trolley')],
      removeKeys: [pickKey('m1', 'gantry')],
    });
  });

  it('변화가 없으면 둘 다 빈 배열 — 전부 풀면 전부 remove', () => {
    expect(diffPickSelection(existing, existing, m1Keys)).toEqual({
      addKeys: [],
      removeKeys: [],
    });
    expect(diffPickSelection(new Set(), existing, m1Keys)).toEqual({
      addKeys: [],
      removeKeys: [pickKey('m1', 'gantry'), pickKey('m1', 'err')],
    });
  });

  it('범위 밖은 건드리지 않는다 — 기존 태그도 선택도', () => {
    const m3Keys = modelPickKeys(models[1]);
    expect(diffPickSelection(new Set(), existing, m3Keys)).toEqual({
      addKeys: [],
      removeKeys: [],
    });
    expect(
      diffPickSelection(new Set([pickKey('m1', 'trolley')]), existing, m3Keys),
    ).toEqual({ addKeys: [], removeKeys: [] });
    expect(diffPickSelection(new Set(), existing, [])).toEqual({
      addKeys: [],
      removeKeys: [],
    });
  });
});
