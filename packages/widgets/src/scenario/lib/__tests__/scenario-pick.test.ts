import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import {
  buildScenarioTags,
  countSelection,
  existingPickKeys,
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

  it('선택 순서와 무관하게 모델 순 › 코드 순, 이미 있는 것은 건너뛴다', () => {
    const selected = new Set([
      pickKey('m3', 'luff'),
      pickKey('m1', 'err'),
      pickKey('m1', 'gantry'),
      pickKey('m1', 'trolley'),
    ]);
    const tags = buildScenarioTags(selected, models, existing);
    expect(tags.map((t) => `${t.modelId}:${t.code}`)).toEqual([
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

  it('요약은 선택된 태그가 있는 모델 수와 태그 수(이미 있는 것 제외)', () => {
    const selected = new Set([
      pickKey('m1', 'gantry'),
      pickKey('m1', 'err'),
      pickKey('m3', 'luff'),
    ]);
    expect(countSelection(selected, models, existing)).toEqual({
      models: 2,
      tags: 2,
    });
    expect(countSelection(selected, models)).toEqual({ models: 2, tags: 3 });
    expect(countSelection(new Set(), models)).toEqual({ models: 0, tags: 0 });
  });
});
