import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import {
  VIRTUAL_TAG_BOOL_PATTERN_KINDS,
  VIRTUAL_TAG_PATTERN_KINDS,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  type ScenarioTag,
  type SimulationScenario,
  type VirtualTagPattern,
} from '@crane/domain/virtual-tag';
import type { ScenarioTagIssue, VirtualTagEntry } from '@crane/features/3d';
import {
  describeKeyframes,
  describePatternSentence,
  formatVirtualValue,
  groupScenarioRows,
  isBoolOn,
  nextPattern,
  nodeLeafName,
  resolveRowControl,
  selectablePatternKinds,
  showsInitialValue,
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

  it('issueCount 는 묶음 안 issue 행 수 — 없으면 0', () => {
    const [m1, ghost, m2] = groupScenarioRows(scenario, scene, entries, issues);
    expect(m1.issueCount).toBe(0);
    expect(ghost.issueCount).toBe(1);
    expect(m2.issueCount).toBe(1);
    expect(
      groupScenarioRows(scenario, scene, entries, []).map((g) => g.issueCount),
    ).toEqual([0, 0, 0]);
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

  it('훅 부착 코드의 대상은 source=hook 과 라벨(없으면 훅 id)', () => {
    const hookScene = {
      models: [
        {
          id: 'm1',
          equipName: 'GC-04',
          craneId: 'GC_04',
          hooks: [
            {
              id: 'hook-upper',
              label: 'Upper',
              nodes: ['a'],
              attachCode: 'up',
            },
            { id: 'hook-lower', nodes: ['b'], attachCode: 'low' },
          ],
        },
      ],
    } as unknown as SavedSceneInfo;
    const hookScenario: SimulationScenario = {
      ...scenario,
      tags: [tag('h1', 'm1', 'up'), tag('h2', 'm1', 'low')],
    };
    const [m1] = groupScenarioRows(hookScenario, hookScene, [], []);
    expect(m1.rows[0].target).toEqual({
      code: 'up',
      source: 'hook',
      hookId: 'hook-upper',
      label: 'Upper',
    });
    expect(m1.rows[1].target).toMatchObject({
      source: 'hook',
      label: 'hook-lower',
    });
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

function withPattern(
  pattern: VirtualTagPattern,
  patch: Partial<ScenarioTag> = {},
): ScenarioTag {
  return { ...tag('t', 'm1', 'code'), pattern, ...patch };
}

describe('resolveRowControl', () => {
  const sine: VirtualTagPattern = { kind: 'sine', periodSec: 8 };
  const square: VirtualTagPattern = { kind: 'square', periodSec: 8 };

  it('issue 가 있으면 키가 있어도 none', () => {
    expect(
      resolveRowControl({
        tag: withPattern({ kind: 'manual' }),
        key: 'GC_04.x',
        issue: 'duplicate-key',
      }),
    ).toBe('none');
  });

  it('issue 가 없어도 키가 없으면 none', () => {
    expect(
      resolveRowControl({
        tag: withPattern({ kind: 'manual' }),
        key: undefined,
        issue: undefined,
      }),
    ).toBe('none');
    expect(
      resolveRowControl({ tag: withPattern(sine), key: '', issue: undefined }),
    ).toBe('none');
  });

  it('숫자는 수동이면 slider, 파형이면 bar', () => {
    const base = { key: 'GC_04.x', issue: undefined };
    expect(
      resolveRowControl({ ...base, tag: withPattern({ kind: 'manual' }) }),
    ).toBe('slider');
    expect(resolveRowControl({ ...base, tag: withPattern(sine) })).toBe('bar');
    expect(resolveRowControl({ ...base, tag: withPattern(square) })).toBe(
      'bar',
    );
  });

  it('불리언은 수동이면 toggle, 구형파면 pill', () => {
    const base = { key: 'GC_04.x', issue: undefined };
    expect(
      resolveRowControl({
        ...base,
        tag: withPattern({ kind: 'manual' }, { dataType: 'bool' }),
      }),
    ).toBe('toggle');
    expect(
      resolveRowControl({
        ...base,
        tag: withPattern(square, { dataType: 'bool' }),
      }),
    ).toBe('pill');
  });
});

const KEYFRAMES: VirtualTagPattern = {
  kind: 'keyframes',
  points: [
    { atSec: 0, value: 0 },
    { atSec: 136.65, value: 1 },
  ],
  loop: true,
};

describe('selectablePatternKinds', () => {
  it('키프레임이 아닌 태그에는 키프레임 버튼이 없다 — 숫자·불리언 모두', () => {
    expect(selectablePatternKinds(withPattern({ kind: 'manual' }))).toEqual(
      VIRTUAL_TAG_PATTERN_KINDS.filter((k) => k !== 'keyframes'),
    );
    expect(
      selectablePatternKinds(
        withPattern({ kind: 'square', periodSec: 10 }, { dataType: 'bool' }),
      ),
    ).toEqual(['manual', 'square']);
  });

  it('이미 키프레임인 태그는 형식별 전체 목록(키프레임 포함)', () => {
    expect(selectablePatternKinds(withPattern(KEYFRAMES))).toBe(
      VIRTUAL_TAG_PATTERN_KINDS,
    );
    expect(
      selectablePatternKinds(withPattern(KEYFRAMES, { dataType: 'bool' })),
    ).toBe(VIRTUAL_TAG_BOOL_PATTERN_KINDS);
  });
});

describe('nextPattern', () => {
  it('같은 종류면 같은 참조 — duty 가 있는 구형파도 그대로', () => {
    const manual: VirtualTagPattern = { kind: 'manual' };
    const square: VirtualTagPattern = {
      kind: 'square',
      periodSec: 10,
      dutyPct: 25,
    };
    expect(nextPattern(manual, 'manual')).toBe(manual);
    expect(nextPattern(square, 'square')).toBe(square);
  });

  it('수동에서 파형으로 가면 기본 주기', () => {
    expect(nextPattern({ kind: 'manual' }, 'sine')).toEqual({
      kind: 'sine',
      periodSec: VIRTUAL_TAG_PERIOD_DEFAULT,
    });
  });

  it('파형끼리는 주기를 이어받는다', () => {
    expect(nextPattern({ kind: 'sawtooth', periodSec: 20 }, 'sine')).toEqual({
      kind: 'sine',
      periodSec: 20,
    });
    expect(nextPattern({ kind: 'sine', periodSec: 0.5 }, 'square')).toEqual({
      kind: 'square',
      periodSec: 0.5,
    });
  });

  it('구형파에서 다른 파형으로 가면 dutyPct 를 버린다', () => {
    const next = nextPattern(
      { kind: 'square', periodSec: 10, dutyPct: 25 },
      'sawtooth',
    );
    expect(next).toEqual({ kind: 'sawtooth', periodSec: 10 });
    expect(next).not.toHaveProperty('dutyPct');
  });

  it('파형에서 수동으로 가면 주기가 없는 manual', () => {
    const next = nextPattern({ kind: 'sine', periodSec: 40 }, 'manual');
    expect(next).toEqual({ kind: 'manual' });
    expect(next).not.toHaveProperty('periodSec');
  });

  it('키프레임에서 파형으로 가면 기본 주기, 수동이면 manual — 점은 버린다', () => {
    expect(nextPattern(KEYFRAMES, 'square')).toEqual({
      kind: 'square',
      periodSec: VIRTUAL_TAG_PERIOD_DEFAULT,
    });
    expect(nextPattern(KEYFRAMES, 'manual')).toEqual({ kind: 'manual' });
  });

  it('키프레임으로는 바꿔 들어가지 않는다 — 같은 참조, 키프레임끼리도 같은 참조', () => {
    const manual: VirtualTagPattern = { kind: 'manual' };
    const sine: VirtualTagPattern = { kind: 'sine', periodSec: 40 };
    expect(nextPattern(manual, 'keyframes')).toBe(manual);
    expect(nextPattern(sine, 'keyframes')).toBe(sine);
    expect(nextPattern(KEYFRAMES, 'keyframes')).toBe(KEYFRAMES);
  });
});

describe('showsInitialValue', () => {
  it('사인·톱니파만 초기값 줄을 둔다', () => {
    expect(showsInitialValue({ kind: 'sine', periodSec: 40 })).toBe(true);
    expect(showsInitialValue({ kind: 'sawtooth', periodSec: 0.1 })).toBe(true);
  });

  it('키프레임은 숨긴다 — 값은 점이 정한다', () => {
    expect(showsInitialValue(KEYFRAMES)).toBe(false);
  });

  it('수동과 구형파(duty 와 무관)는 숨긴다', () => {
    expect(showsInitialValue({ kind: 'manual' })).toBe(false);
    expect(showsInitialValue({ kind: 'square', periodSec: 10 })).toBe(false);
    expect(
      showsInitialValue({ kind: 'square', periodSec: 10, dutyPct: 25 }),
    ).toBe(false);
  });
});

describe('describePatternSentence', () => {
  it('수동은 주기가 없어 null — 숫자·불리언 모두', () => {
    expect(describePatternSentence(withPattern({ kind: 'manual' }))).toBeNull();
    expect(
      describePatternSentence(
        withPattern({ kind: 'manual' }, { dataType: 'bool' }),
      ),
    ).toBeNull();
  });

  it('키프레임은 주기가 없어 null — 숫자·불리언 모두', () => {
    expect(describePatternSentence(withPattern(KEYFRAMES))).toBeNull();
    expect(
      describePatternSentence(withPattern(KEYFRAMES, { dataType: 'bool' })),
    ).toBeNull();
  });

  it('사인·톱니파는 파형 이름이 키, 단위는 앞 공백을 붙인다', () => {
    const patch = { min: 0, max: 60, unit: 'm' };
    expect(
      describePatternSentence(
        withPattern({ kind: 'sine', periodSec: 20 }, patch),
      ),
    ).toEqual({
      key: 'sine',
      values: { period: '20', min: '0', max: '60', unit: ' m', duty: '50' },
    });
    expect(
      describePatternSentence(withPattern({ kind: 'sawtooth', periodSec: 40 }))
        ?.key,
    ).toBe('sawtooth');
  });

  it('단위가 없거나 공백뿐이면 빈 문자열, 앞뒤 공백은 뗀다', () => {
    const sine: VirtualTagPattern = { kind: 'sine', periodSec: 8 };
    expect(describePatternSentence(withPattern(sine))?.values.unit).toBe('');
    expect(
      describePatternSentence(withPattern(sine, { unit: '   ' }))?.values.unit,
    ).toBe('');
    expect(
      describePatternSentence(withPattern(sine, { unit: '  deg ' }))?.values
        .unit,
    ).toBe(' deg');
  });

  it('음수·소수 범위와 소수 주기는 formatVirtualValue 표기', () => {
    expect(
      describePatternSentence(
        withPattern(
          { kind: 'sine', periodSec: 0.5 },
          { min: -32, max: 11.75, unit: 'deg' },
        ),
      )?.values,
    ).toEqual({
      period: '0.5',
      min: '-32',
      max: '11.75',
      unit: ' deg',
      duty: '50',
    });
  });

  it('구형파는 duty 가 없거나 50 이면 square, 아니면 squareDuty', () => {
    expect(
      describePatternSentence(withPattern({ kind: 'square', periodSec: 10 }))
        ?.key,
    ).toBe('square');
    expect(
      describePatternSentence(
        withPattern({ kind: 'square', periodSec: 10, dutyPct: 50 }),
      )?.key,
    ).toBe('square');
    expect(
      describePatternSentence(
        withPattern({ kind: 'square', periodSec: 10, dutyPct: 25 }),
      ),
    ).toMatchObject({ key: 'squareDuty', values: { duty: '25' } });
  });

  it('duty 경계 0·100 은 squareDuty, 범위 밖은 클램프, 숫자가 아니면 기본 50', () => {
    const square = (dutyPct: number) =>
      describePatternSentence(
        withPattern({ kind: 'square', periodSec: 10, dutyPct }),
      );
    expect(square(0)).toMatchObject({
      key: 'squareDuty',
      values: { duty: '0' },
    });
    expect(square(100)).toMatchObject({
      key: 'squareDuty',
      values: { duty: '100' },
    });
    expect(square(150)).toMatchObject({
      key: 'squareDuty',
      values: { duty: '100' },
    });
    expect(square(-5)).toMatchObject({
      key: 'squareDuty',
      values: { duty: '0' },
    });
    expect(square(Number.NaN)).toMatchObject({
      key: 'square',
      values: { duty: '50' },
    });
  });

  it('불리언 구형파는 boolSquare(Duty) 이고 단위가 있어도 넣지 않는다', () => {
    expect(
      describePatternSentence(
        withPattern(
          { kind: 'square', periodSec: 10 },
          { dataType: 'bool', unit: 'm' },
        ),
      ),
    ).toMatchObject({ key: 'boolSquare', values: { period: '10', unit: '' } });
    expect(
      describePatternSentence(
        withPattern(
          { kind: 'square', periodSec: 10, dutyPct: 30 },
          { dataType: 'bool' },
        ),
      ),
    ).toMatchObject({ key: 'boolSquareDuty', values: { duty: '30' } });
  });
});

describe('describeKeyframes', () => {
  it('점 수·총 길이(마지막 점 시각)·반복·가감속', () => {
    expect(
      describeKeyframes({
        kind: 'keyframes',
        points: [
          { atSec: 0, value: 0 },
          { atSec: 18.13, value: 0 },
          { atSec: 518.62, value: 0 },
        ],
        loop: true,
        ease: 'smooth',
      }),
    ).toEqual({ count: 3, total: '518.62', loop: true, smooth: true });
  });

  it('loop·ease 가 없으면 false, 점 하나면 그 시각이 길이', () => {
    expect(
      describeKeyframes({
        kind: 'keyframes',
        points: [{ atSec: 0, value: 5 }],
      }),
    ).toEqual({ count: 1, total: '0', loop: false, smooth: false });
  });

  it('점이 없으면 0점 · 0초 — sanitize 를 거치지 않은 값도 던지지 않는다', () => {
    expect(describeKeyframes({ kind: 'keyframes', points: [] })).toEqual({
      count: 0,
      total: '0',
      loop: false,
      smooth: false,
    });
  });

  it('총 길이는 formatVirtualValue 표기 — 소수 셋째 자리, 꼬리 0 제거', () => {
    expect(
      describeKeyframes({
        kind: 'keyframes',
        points: [{ atSec: 497.7604, value: 0 }],
      }).total,
    ).toBe('497.76');
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
