import { describe, expect, it } from 'vitest';
import {
  clampVirtualTagPeriod,
  clampVirtualTagTick,
  createEmptyScenarioSet,
  sanitizeScenario,
  sanitizeScenarioList,
  sanitizeScenarioSet,
  sanitizeScenarioTag,
  sanitizeScenarioTagList,
  sanitizeVirtualTag,
  sanitizeVirtualTagPattern,
  scenarioTagKey,
} from '../sanitize-scenarios';
import {
  SCENARIO_NAME_MAX,
  SCENARIO_TAGS_MAX,
  SCENARIOS_MAX,
  VIRTUAL_TAG_CODE_MAX,
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
  pattern: { kind: 'triangle', periodSec: 2 },
};

const scenarioTag = { ...tag, modelId: 'model-1' };

const scenario = {
  id: 's1',
  name: ' 횡행 중 고장 ',
  sceneFile: 'dock-in.json',
  tags: [scenarioTag],
};

describe('clamp helpers (초 단위)', () => {
  it('tick: 경계 정확값 통과, 밖은 클램프, 손상은 기본값', () => {
    expect(clampVirtualTagTick(VIRTUAL_TAG_TICK_MIN)).toBe(
      VIRTUAL_TAG_TICK_MIN,
    );
    expect(clampVirtualTagTick(VIRTUAL_TAG_TICK_MAX)).toBe(
      VIRTUAL_TAG_TICK_MAX,
    );
    expect(clampVirtualTagTick(VIRTUAL_TAG_TICK_MIN / 2)).toBe(
      VIRTUAL_TAG_TICK_MIN,
    );
    expect(clampVirtualTagTick(VIRTUAL_TAG_TICK_MAX + 1)).toBe(
      VIRTUAL_TAG_TICK_MAX,
    );
    expect(clampVirtualTagTick('x')).toBe(VIRTUAL_TAG_TICK_DEFAULT);
    expect(clampVirtualTagTick(NaN)).toBe(VIRTUAL_TAG_TICK_DEFAULT);
  });

  it('ms 해상도(소수 셋째 자리)로 반올림한다 — 부동소수 잡음이 dirty 를 만들지 않게', () => {
    expect(clampVirtualTagTick(0.1 + 0.2)).toBe(0.3);
    expect(clampVirtualTagPeriod(1.23456)).toBe(1.235);
  });

  it('period: 같은 규칙', () => {
    expect(clampVirtualTagPeriod(VIRTUAL_TAG_PERIOD_MIN)).toBe(
      VIRTUAL_TAG_PERIOD_MIN,
    );
    expect(clampVirtualTagPeriod(VIRTUAL_TAG_PERIOD_MAX + 5)).toBe(
      VIRTUAL_TAG_PERIOD_MAX,
    );
    expect(clampVirtualTagPeriod(undefined)).toBe(VIRTUAL_TAG_PERIOD_DEFAULT);
  });
});

describe('sanitizeVirtualTagPattern', () => {
  it('모르는 종류·비객체는 manual', () => {
    expect(sanitizeVirtualTagPattern(null)).toEqual({ kind: 'manual' });
    expect(sanitizeVirtualTagPattern({ kind: 'noise' })).toEqual({
      kind: 'manual',
    });
  });

  it('주기 파형은 periodSec 클램프, square 는 dutyPct 를 [0,100] 으로', () => {
    expect(
      sanitizeVirtualTagPattern({ kind: 'sine', periodSec: 0.01 }),
    ).toEqual({ kind: 'sine', periodSec: VIRTUAL_TAG_PERIOD_MIN });
    expect(
      sanitizeVirtualTagPattern({ kind: 'square', periodSec: 1, dutyPct: 150 }),
    ).toEqual({ kind: 'square', periodSec: 1, dutyPct: 100 });
    expect(
      sanitizeVirtualTagPattern({ kind: 'square', periodSec: 1, dutyPct: 'x' }),
    ).toEqual({ kind: 'square', periodSec: 1 });
    expect(sanitizeVirtualTagPattern({ kind: 'sawtooth' })).toEqual({
      kind: 'sawtooth',
      periodSec: VIRTUAL_TAG_PERIOD_DEFAULT,
    });
  });

  it('제거된 random-walk 저장본은 manual 로 떨어진다', () => {
    expect(
      sanitizeVirtualTagPattern({ kind: 'random-walk', stepPct: 5, seed: 1 }),
    ).toEqual({ kind: 'manual' });
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
      pattern: { kind: 'triangle', periodSec: 2 },
    });
    expect(sanitizeVirtualTag({ ...tag, dataType: 'float' })?.dataType).toBe(
      'number',
    );
  });

  it('id 가 없거나 코드가 비었거나 공백·점·콜론이 있거나 길면 버린다', () => {
    expect(sanitizeVirtualTag({ ...tag, id: '' })).toBeNull();
    expect(sanitizeVirtualTag({ ...tag, code: '  ' })).toBeNull();
    expect(sanitizeVirtualTag({ ...tag, code: 'a b' })).toBeNull();
    expect(sanitizeVirtualTag({ ...tag, code: 'a:b' })).toBeNull();
    expect(sanitizeVirtualTag({ ...tag, code: 'a.b' })).toBeNull();
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

  it('min ≥ max 면 최소 폭 1 을 주고, initial 은 범위로 클램프, 이름은 길이 제한', () => {
    const out = sanitizeVirtualTag({
      ...tag,
      min: 5,
      max: 5,
      initial: 99,
      name: 'n'.repeat(VIRTUAL_TAG_NAME_MAX + 5),
      unit: '',
    });
    expect(out).toMatchObject({ min: 5, max: 6, initial: 6 });
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
  });
});

describe('sanitizeVirtualTag — 불리언', () => {
  const bool = { ...tag, dataType: 'bool' };

  it('범위 0~1·초기값 0/1 로 강제하고 단위를 뗀다', () => {
    const out = sanitizeVirtualTag({
      ...bool,
      min: -5,
      max: 50,
      initial: 0.7,
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
    });
    expect(sanitizeVirtualTag({ ...bool, initial: -3 })?.initial).toBe(0);
    expect(sanitizeVirtualTag({ ...bool, initial: 'x' })?.initial).toBe(0);
    expect(sanitizeVirtualTag({ ...bool, initial: 0.49 })?.initial).toBe(0);
  });

  it('패턴은 manual·square 만 — 다른 파형은 manual 로', () => {
    expect(
      sanitizeVirtualTag({ ...bool, pattern: { kind: 'sine', periodSec: 1 } })
        ?.pattern,
    ).toEqual({ kind: 'manual' });
    expect(
      sanitizeVirtualTag({
        ...bool,
        pattern: { kind: 'square', periodSec: 1, dutyPct: 30 },
      })?.pattern,
    ).toEqual({ kind: 'square', periodSec: 1, dutyPct: 30 });
  });
});

describe('sanitizeScenarioTag / List', () => {
  it('정의에 modelId 를 더한다 — modelId 가 없거나 비면 버린다', () => {
    expect(sanitizeScenarioTag(scenarioTag)).toEqual({
      ...sanitizeVirtualTag(tag),
      modelId: 'model-1',
    });
    expect(sanitizeScenarioTag(tag)).toBeNull();
    expect(sanitizeScenarioTag({ ...scenarioTag, modelId: '' })).toBeNull();
    expect(sanitizeScenarioTag({ ...scenarioTag, modelId: 3 })).toBeNull();
  });

  it('목록 — id·(modelId, code) 중복은 첫 항목, 손상은 건너뛰고, 상한을 넘기지 않는다', () => {
    const list = sanitizeScenarioTagList([
      scenarioTag,
      { ...scenarioTag, id: 'b' }, // (modelId, code) 중복
      { ...scenarioTag, code: 'other' }, // id 중복
      { ...scenarioTag, id: 'c', modelId: 'model-2' }, // 다른 모델의 같은 코드
      null,
      { ...scenarioTag, id: 'd', code: 'd' },
    ]);
    expect(list.map((t) => `${t.id}:${t.modelId}:${t.code}`)).toEqual([
      'a:model-1:x',
      'c:model-2:x',
      'd:model-1:d',
    ]);

    const many = Array.from({ length: SCENARIO_TAGS_MAX + 1 }, (_, i) => ({
      ...scenarioTag,
      id: `id-${i}`,
      code: `k-${i}`,
    }));
    expect(sanitizeScenarioTagList(many)).toHaveLength(SCENARIO_TAGS_MAX);
    expect(sanitizeScenarioTagList('x')).toEqual([]);
  });

  it('scenarioTagKey 는 modelId 와 code 를 함께 본다', () => {
    expect(scenarioTagKey({ modelId: 'a', code: 'x' })).toBe(
      scenarioTagKey({ modelId: 'a', code: 'x' }),
    );
    expect(scenarioTagKey({ modelId: 'a', code: 'x' })).not.toBe(
      scenarioTagKey({ modelId: 'b', code: 'x' }),
    );
  });
});

describe('sanitizeScenario / List', () => {
  it('유효 시나리오는 이름을 trim 해 통과한다', () => {
    expect(sanitizeScenario(scenario)).toEqual({
      id: 's1',
      name: '횡행 중 고장',
      sceneFile: 'dock-in.json',
      tags: [sanitizeScenarioTag(scenarioTag)],
    });
  });

  it('id·sceneFile 필수, 이름은 길이 제한·비면 id', () => {
    expect(sanitizeScenario({ ...scenario, id: '' })).toBeNull();
    expect(sanitizeScenario({ ...scenario, sceneFile: '  ' })).toBeNull();
    expect(sanitizeScenario({ ...scenario, sceneFile: 3 })).toBeNull();
    expect(sanitizeScenario({ ...scenario, name: '   ' })?.name).toBe('s1');
    expect(
      sanitizeScenario({ ...scenario, name: 'n'.repeat(SCENARIO_NAME_MAX + 3) })
        ?.name,
    ).toHaveLength(SCENARIO_NAME_MAX);
    expect(sanitizeScenario({ ...scenario, tags: 'x' })?.tags).toEqual([]);
    expect(sanitizeScenario(null)).toBeNull();
  });

  it('목록 — id 중복은 첫 항목, 손상 건너뜀, 상한', () => {
    const list = sanitizeScenarioList([
      scenario,
      { ...scenario, name: 'dup' },
      { ...scenario, id: 's2' },
      'x',
    ]);
    expect(list.map((s) => `${s.id}:${s.name}`)).toEqual([
      's1:횡행 중 고장',
      's2:횡행 중 고장',
    ]);
    const many = Array.from({ length: SCENARIOS_MAX + 1 }, (_, i) => ({
      ...scenario,
      id: `s-${i}`,
    }));
    expect(sanitizeScenarioList(many)).toHaveLength(SCENARIOS_MAX);
    expect(sanitizeScenarioList(undefined)).toEqual([]);
  });
});

describe('sanitizeScenarioSet', () => {
  it('봉투가 아니면 빈 세트', () => {
    expect(sanitizeScenarioSet(null)).toEqual(createEmptyScenarioSet());
    expect(sanitizeScenarioSet('x')).toEqual(createEmptyScenarioSet());
    expect(sanitizeScenarioSet([])).toEqual(createEmptyScenarioSet());
  });

  it('scenarios 배열이 있으면 버전 1 로 정규화하고 tick 은 클램프한다', () => {
    const out = sanitizeScenarioSet({
      version: 1,
      tickSec: 99,
      scenarios: [scenario],
    });
    expect(out.version).toBe(1);
    expect(out.tickSec).toBe(VIRTUAL_TAG_TICK_MAX);
    expect(out.scenarios.map((s) => s.id)).toEqual(['s1']);
  });

  it('정규화는 멱등이다 — 저장본을 다시 넣으면 같은 값', () => {
    const once = sanitizeScenarioSet({
      version: 1,
      tickSec: 0.1,
      scenarios: [scenario],
    });
    expect(sanitizeScenarioSet(once)).toEqual(once);
  });

  it('옛 가상 태그 세트(equipments)·버전 1 평탄 목록은 tick 만 살린 빈 세트', () => {
    expect(
      sanitizeScenarioSet({
        version: 3,
        tickSec: 0.2,
        equipments: [{ id: 'e' }],
      }),
    ).toEqual({ version: 1, tickSec: 0.2, scenarios: [] });
    expect(sanitizeScenarioSet({ version: 1, tickMs: 100, tags: [] })).toEqual(
      createEmptyScenarioSet(),
    );
  });
});

describe('배포 파일 모양(scenarios.json)', () => {
  it('새 포맷을 읽으면 바뀌는 것이 없다 — 발췌 fixture', () => {
    const deployed = {
      version: 1,
      tickSec: 0.1,
      scenarios: [
        {
          id: 'default',
          name: '기본',
          sceneFile: 'philly-2dock.json',
          tags: [
            {
              id: 'gc04-gantry-travel',
              modelId: 'id-mt0rhrsw-icvq0ukr',
              code: 'gantry_position',
              name: '',
              dataType: 'number',
              unit: 'm',
              min: 0,
              max: 300,
              initial: 0,
              pattern: { kind: 'sine', periodSec: 40 },
            },
            {
              id: 'llc002-luffing',
              modelId: 'id-mt0riz7x-bxncy0uk',
              code: 'luff_angle',
              name: '',
              dataType: 'number',
              unit: 'deg',
              min: -32,
              max: 11.75,
              initial: 0,
              pattern: { kind: 'sine', periodSec: 30 },
            },
          ],
        },
      ],
    };
    expect(sanitizeScenarioSet(deployed)).toEqual(deployed);
  });
});
