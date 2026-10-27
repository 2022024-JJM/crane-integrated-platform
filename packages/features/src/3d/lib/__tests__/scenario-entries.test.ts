import { describe, expect, it } from 'vitest';
import type { SavedModelInfo, SavedSceneInfo } from '@crane/domain/3d';
import type {
  ScenarioTag,
  SimulationScenario,
} from '@crane/domain/virtual-tag';
import { collectScenarioEntries } from '../scenario-entries';

function model(
  overrides: Partial<SavedModelInfo> & { id: string },
): SavedModelInfo {
  return {
    equipName: overrides.id.toUpperCase(),
    path: '/m.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    ...overrides,
  };
}

function tag(id: string, modelId: string, code: string): ScenarioTag {
  return {
    id,
    modelId,
    code,
    name: '',
    dataType: 'number',
    min: 0,
    max: 10,
    initial: 0,
    pattern: { kind: 'manual' },
  };
}

const scene: SavedSceneInfo = {
  maps: [],
  texts: [],
  models: [
    model({
      id: 'mA',
      craneId: 'GC-04',
      tagMappings: [
        {
          id: 'map-1',
          target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
          code: 'gantry',
        },
        {
          id: 'map-2',
          target: { kind: 'node', node: '', channel: 'position', axis: 'x' },
          code: 'other',
          craneId: 'GC-05',
        },
      ],
      statusTags: { fault: 'err' },
    }),
    model({ id: 'noCrane', tagMappings: [] }),
  ],
} as unknown as SavedSceneInfo;

function scenario(tags: ScenarioTag[]): SimulationScenario {
  return { id: 's', name: 'S', sceneFile: 'x.json', tags };
}

describe('collectScenarioEntries', () => {
  it('씬 모델의 craneId 와 코드로 키를 만들고 모델 이름·크레인을 함께 싣는다', () => {
    const { entries, issues } = collectScenarioEntries(
      scenario([tag('a', 'mA', 'gantry'), tag('b', 'mA', 'err')]),
      scene,
    );
    expect(issues).toEqual([]);
    expect(
      entries.map((e) => [e.key, e.modelId, e.modelName, e.craneId]),
    ).toEqual([
      ['GC_04.gantry', 'mA', 'MA', 'GC-04'],
      ['GC_04.err', 'mA', 'MA', 'GC-04'],
    ]);
    expect(entries[0].tag.id).toBe('a');
  });

  it('코드가 맵핑에 있으면 그 맵핑의 craneId 덮어쓰기를 따른다', () => {
    const { entries } = collectScenarioEntries(
      scenario([tag('a', 'mA', 'other')]),
      scene,
    );
    expect(entries.map((e) => e.key)).toEqual(['GC_05.other']);
  });

  it('모델 없음·크레인 없음·키 중복은 건너뛰고 이유를 남긴다', () => {
    const { entries, issues } = collectScenarioEntries(
      scenario([
        tag('a', 'ghost', 'gantry'),
        tag('b', 'noCrane', 'gantry'),
        tag('c', 'mA', 'gantry'),
        tag('d', 'mA', 'gantry'),
      ]),
      scene,
    );
    expect(entries.map((e) => e.tag.id)).toEqual(['c']);
    expect(issues).toEqual([
      { tagId: 'a', modelId: 'ghost', code: 'gantry', reason: 'model-missing' },
      {
        tagId: 'b',
        modelId: 'noCrane',
        code: 'gantry',
        reason: 'crane-missing',
      },
      { tagId: 'd', modelId: 'mA', code: 'gantry', reason: 'duplicate-key' },
    ]);
  });

  it('시나리오·씬이 없거나 태그가 비면 같은 빈 결과 참조', () => {
    const none = collectScenarioEntries(null, scene);
    expect(none).toEqual({ entries: [], issues: [] });
    expect(collectScenarioEntries(scenario([]), scene)).toBe(none);
    expect(collectScenarioEntries(undefined, null)).toBe(none);
    // 씬이 없으면 전부 모델 없음.
    expect(
      collectScenarioEntries(scenario([tag('a', 'mA', 'gantry')]), null).issues,
    ).toEqual([
      { tagId: 'a', modelId: 'mA', code: 'gantry', reason: 'model-missing' },
    ]);
  });
});
