import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type {
  ScenarioTag,
  SimulationScenario,
} from '@crane/domain/virtual-tag';
import type { ScenarioTagIssue, VirtualTagEntry } from '@crane/features/3d';
import {
  formatVirtualValue,
  groupScenarioRows,
  isBoolOn,
  nodeLeafName,
  sliderStep,
  valuePercent,
} from '../scenario-rows';

function tag(id: string, modelId: string, code: string): ScenarioTag {
  return {
    id,
    modelId,
    code,
    name: '',
    dataType: 'number',
    min: 0,
    max: 100,
    initial: 0,
    pattern: { kind: 'manual' },
  };
}

const scene = {
  models: [
    {
      id: 'm1',
      equipName: 'GC-04',
      craneId: 'GC_04',
      tagMappings: [
        {
          id: 'map-1',
          code: 'gantry',
          target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
        },
      ],
      statusTags: { fault: 'err' },
    },
    { id: 'm2', equipName: 'No crane', tagMappings: [] },
  ],
} as unknown as SavedSceneInfo;

const scenario: SimulationScenario = {
  id: 's',
  name: 'S',
  sceneFile: 'x.json',
  tags: [
    tag('t1', 'm1', 'gantry'),
    tag('t2', 'ghost', 'z'),
    tag('t3', 'm1', 'err'),
    tag('t4', 'm1', 'removed'),
    tag('t5', 'm2', 'z'),
  ],
};

const entries: VirtualTagEntry[] = [
  {
    key: 'GC_04.gantry',
    tag: scenario.tags[0],
    modelId: 'm1',
    modelName: 'GC-04',
    craneId: 'GC_04',
  },
  {
    key: 'GC_04.err',
    tag: scenario.tags[2],
    modelId: 'm1',
    modelName: 'GC-04',
    craneId: 'GC_04',
  },
];
const issues: ScenarioTagIssue[] = [
  { tagId: 't2', modelId: 'ghost', code: 'z', reason: 'model-missing' },
  { tagId: 't5', modelId: 'm2', code: 'z', reason: 'crane-missing' },
];

describe('groupScenarioRows', () => {
  it('시나리오가 없으면 빈 배열', () => {
    expect(groupScenarioRows(null, scene, [], [])).toEqual([]);
  });

  it('모델은 처음 등장한 순서, 행은 시나리오의 태그 순서를 지킨다', () => {
    const groups = groupScenarioRows(scenario, scene, entries, issues);
    expect(groups.map((g) => g.modelId)).toEqual(['m1', 'ghost', 'm2']);
    expect(groups[0].rows.map((r) => r.tag.id)).toEqual(['t1', 't3', 't4']);
  });

  it('씬에 있는 모델은 이름·크레인·present, 없는 모델은 id 가 이름이고 present=false', () => {
    const [m1, ghost, m2] = groupScenarioRows(scenario, scene, entries, issues);
    expect(m1).toMatchObject({
      modelName: 'GC-04',
      craneId: 'GC_04',
      present: true,
    });
    expect(ghost).toMatchObject({
      modelName: 'ghost',
      craneId: undefined,
      present: false,
    });
    expect(m2).toMatchObject({
      modelName: 'No crane',
      craneId: undefined,
      present: true,
    });
  });

  it('키·issue 는 엔트리·issue 목록에서 태그 id 로 찾는다', () => {
    const [m1, ghost, m2] = groupScenarioRows(scenario, scene, entries, issues);
    expect(m1.rows[0]).toMatchObject({ key: 'GC_04.gantry', issue: undefined });
    expect(ghost.rows[0]).toMatchObject({
      key: undefined,
      issue: 'model-missing',
    });
    expect(m2.rows[0]).toMatchObject({
      key: undefined,
      issue: 'crane-missing',
    });
  });

  it('맵핑 대상은 모델의 맵핑·상태 태그에서, 사라진 코드는 undefined', () => {
    const [m1] = groupScenarioRows(scenario, scene, entries, issues);
    expect(m1.rows[0].target).toMatchObject({
      source: 'mapping',
      mappingId: 'map-1',
    });
    expect(m1.rows[1].target).toMatchObject({
      source: 'status',
      role: 'fault',
    });
    expect(m1.rows[2].target).toBeUndefined();
  });

  it('씬이 없으면 모든 모델이 present=false', () => {
    const groups = groupScenarioRows(scenario, null, [], []);
    expect(groups.every((g) => !g.present)).toBe(true);
    expect(groups[0].rows[0].target).toBeUndefined();
  });
});

describe('formatVirtualValue', () => {
  it('없음·NaN·무한은 대시', () => {
    expect(formatVirtualValue(undefined)).toBe('—');
    expect(formatVirtualValue(Number.NaN)).toBe('—');
    expect(formatVirtualValue(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('소수 셋째 자리까지, 꼬리 0 은 뗀다', () => {
    expect(formatVirtualValue(1.23456)).toBe('1.235');
    expect(formatVirtualValue(2)).toBe('2');
    expect(formatVirtualValue(-0.1)).toBe('-0.1');
    expect(formatVirtualValue(0.0004)).toBe('0');
  });

  it('불리언은 0.5 문턱으로 1/0', () => {
    expect(formatVirtualValue(0.5, 'bool')).toBe('1');
    expect(formatVirtualValue(0.49, 'bool')).toBe('0');
  });
});

describe('valuePercent · sliderStep · isBoolOn', () => {
  it('범위 안 위치를 0~100 으로, 밖은 클램프', () => {
    expect(valuePercent(50, 0, 100)).toBe(50);
    expect(valuePercent(0, 0, 100)).toBe(0);
    expect(valuePercent(100, 0, 100)).toBe(100);
    expect(valuePercent(101, 0, 100)).toBe(100);
    expect(valuePercent(-1, 0, 100)).toBe(0);
    expect(valuePercent(-10, -20, 0)).toBe(50);
  });

  it('값 없음·범위 0 이하는 0', () => {
    expect(valuePercent(undefined, 0, 100)).toBe(0);
    expect(valuePercent(Number.NaN, 0, 100)).toBe(0);
    expect(valuePercent(5, 10, 10)).toBe(0);
    expect(valuePercent(5, 10, 0)).toBe(0);
  });

  it('슬라이더 step 은 범위의 1/200, 범위가 없으면 1', () => {
    expect(sliderStep(0, 100)).toBe(0.5);
    expect(sliderStep(0, 0)).toBe(1);
    expect(sliderStep(10, 0)).toBe(1);
  });

  it('불리언 켜짐은 0.5 이상', () => {
    expect(isBoolOn(undefined)).toBe(false);
    expect(isBoolOn(0.5)).toBe(true);
    expect(isBoolOn(0.499)).toBe(false);
  });
});

describe('nodeLeafName', () => {
  it('마지막 세그먼트의 인덱스 접두를 뗀다, 루트는 빈 문자열', () => {
    expect(nodeLeafName('')).toBe('');
    expect(nodeLeafName('[0]Goliath/[1]Trolley_01')).toBe('Trolley_01');
    expect(nodeLeafName('[3]Arm')).toBe('Arm');
    expect(nodeLeafName('Arm')).toBe('Arm');
  });
});
