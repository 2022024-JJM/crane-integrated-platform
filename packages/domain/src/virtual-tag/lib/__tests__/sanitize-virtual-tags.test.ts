import { describe, expect, it } from 'vitest';
import {
  clampVirtualTagPeriod,
  clampVirtualTagTick,
  normalizeVirtualTagKey,
  sanitizeVirtualTag,
  sanitizeVirtualTagLimits,
  sanitizeVirtualTagList,
  sanitizeVirtualTagPattern,
  sanitizeVirtualTagSet,
  sanitizeScenario,
  sanitizeScenarioKeyframe,
  sanitizeScenarioList,
  sanitizeScenarioTrack,
} from '../sanitize-virtual-tags';
import {
  VIRTUAL_TAG_KEY_MAX,
  VIRTUAL_TAG_NAME_MAX,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  VIRTUAL_TAG_PERIOD_MAX,
  VIRTUAL_TAG_PERIOD_MIN,
  VIRTUAL_TAG_TICK_DEFAULT,
  VIRTUAL_TAG_TICK_MAX,
  VIRTUAL_TAG_TICK_MIN,
  VIRTUAL_TAGS_MAX,
  SCENARIO_KEYFRAMES_MAX,
  SCENARIO_NAME_MAX,
  SCENARIO_TIME_MAX_MS,
  SCENARIOS_MAX,
} from '../../model/types';

const valid = {
  id: 'a',
  key: ' C_1:x ',
  name: 'X',
  unit: 'mm',
  min: -10,
  max: 10,
  initial: 3,
  pattern: { kind: 'triangle', periodMs: 2000 },
  enabled: true,
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

  it('key: trim, 빈 값·길이 초과·비문자열은 null', () => {
    expect(normalizeVirtualTagKey(' a:b ')).toBe('a:b');
    expect(normalizeVirtualTagKey('   ')).toBeNull();
    expect(
      normalizeVirtualTagKey('x'.repeat(VIRTUAL_TAG_KEY_MAX)),
    ).toHaveLength(VIRTUAL_TAG_KEY_MAX);
    expect(
      normalizeVirtualTagKey('x'.repeat(VIRTUAL_TAG_KEY_MAX + 1)),
    ).toBeNull();
    expect(normalizeVirtualTagKey(12)).toBeNull();
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

describe('sanitizeVirtualTag', () => {
  it('유효 항목은 trim·클램프해 통과한다', () => {
    expect(sanitizeVirtualTag(valid)).toEqual({
      id: 'a',
      key: 'C_1:x',
      name: 'X',
      unit: 'mm',
      min: -10,
      max: 10,
      initial: 3,
      pattern: { kind: 'triangle', periodMs: 2000 },
      enabled: true,
    });
  });

  it('id·key 가 없으면 버린다', () => {
    expect(sanitizeVirtualTag({ ...valid, id: '' })).toBeNull();
    expect(sanitizeVirtualTag({ ...valid, key: '  ' })).toBeNull();
    expect(sanitizeVirtualTag('garbage')).toBeNull();
  });

  it('min ≥ max 면 최소 폭 1 을 주고, initial 은 범위로 클램프, 이름은 길이 제한', () => {
    const out = sanitizeVirtualTag({
      ...valid,
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
      sanitizeVirtualTag({ ...valid, min: NaN, max: 'x', initial: 'y' }),
    ).toMatchObject({
      min: 0,
      max: 100,
      initial: 0,
    });
    expect(sanitizeVirtualTag({ ...valid, enabled: false })?.enabled).toBe(
      false,
    );
  });
});

describe('sanitizeVirtualTagList / Set', () => {
  it('id·key 중복은 첫 항목, 손상은 건너뛰고, 상한을 넘기지 않는다', () => {
    const list = sanitizeVirtualTagList([
      valid,
      { ...valid, id: 'b' }, // key 중복
      { ...valid, key: 'other' }, // id 중복
      null,
      { ...valid, id: 'c', key: 'c' },
    ]);
    expect(list.map((t) => t.id)).toEqual(['a', 'c']);

    const many = Array.from({ length: VIRTUAL_TAGS_MAX + 1 }, (_, i) => ({
      ...valid,
      id: `id-${i}`,
      key: `k-${i}`,
    }));
    expect(sanitizeVirtualTagList(many)).toHaveLength(VIRTUAL_TAGS_MAX);
    expect(sanitizeVirtualTagList('x')).toEqual([]);
  });

  it('봉투가 아니면 빈 세트, 배열만 있으면(봉투 이전) 태그로 받아 준다', () => {
    expect(sanitizeVirtualTagSet(null)).toEqual({
      version: 1,
      tickMs: 100,
      tags: [],
    });
    expect(sanitizeVirtualTagSet('x')).toEqual({
      version: 1,
      tickMs: 100,
      tags: [],
    });
    expect(sanitizeVirtualTagSet([valid]).tags).toHaveLength(1);
    expect(
      sanitizeVirtualTagSet({ version: 1, tickMs: 250, tags: [valid] }),
    ).toMatchObject({
      version: 1,
      tickMs: 250,
    });
    expect(
      sanitizeVirtualTagSet({ version: 9, tickMs: 'x', tags: 'y' }),
    ).toEqual({
      version: 1,
      tickMs: 100,
      tags: [],
    });
  });
});

describe('sanitizeScenario*', () => {
  it('키프레임 — atMs 클램프·반올림, linear 는 생략, 손상은 null', () => {
    expect(
      sanitizeScenarioKeyframe({ atMs: 10.4, value: 1, ease: 'linear' }),
    ).toEqual({ atMs: 10, value: 1 });
    expect(
      sanitizeScenarioKeyframe({ atMs: -5, value: 1, ease: 'hold' }),
    ).toEqual({
      atMs: 0,
      value: 1,
      ease: 'hold',
    });
    expect(
      sanitizeScenarioKeyframe({ atMs: SCENARIO_TIME_MAX_MS + 1, value: 0 })
        ?.atMs,
    ).toBe(SCENARIO_TIME_MAX_MS);
    expect(
      sanitizeScenarioKeyframe({ atMs: 1, value: 1, ease: 'bounce' }),
    ).toEqual({
      atMs: 1,
      value: 1,
    });
    expect(sanitizeScenarioKeyframe({ atMs: 'a', value: 1 })).toBeNull();
    expect(sanitizeScenarioKeyframe({ atMs: 1, value: NaN })).toBeNull();
    expect(sanitizeScenarioKeyframe(null)).toBeNull();
  });

  it('트랙 — 키 정규화, 정렬·중복 제거, 빈 트랙·나쁜 키는 null, 상한', () => {
    const track = sanitizeScenarioTrack({
      key: ' A:x ',
      keyframes: [
        { atMs: 500, value: 2 },
        { atMs: 0, value: 1 },
        { atMs: 500, value: 9 },
        'garbage',
      ],
    });
    expect(track).toEqual({
      key: 'A:x',
      keyframes: [
        { atMs: 0, value: 1 },
        { atMs: 500, value: 2 },
      ],
    });
    expect(sanitizeScenarioTrack({ key: 'A:x', keyframes: [] })).toBeNull();
    expect(
      sanitizeScenarioTrack({ key: '', keyframes: [{ atMs: 0, value: 0 }] }),
    ).toBeNull();
    const many = Array.from({ length: SCENARIO_KEYFRAMES_MAX + 5 }, (_, i) => ({
      atMs: i,
      value: i,
    }));
    expect(
      sanitizeScenarioTrack({ key: 'k', keyframes: many })?.keyframes,
    ).toHaveLength(SCENARIO_KEYFRAMES_MAX);
  });

  it('시나리오 — id 필수, 이름 길이, loop 는 true 만, 트랙 키 중복 첫 항목', () => {
    const scenario = sanitizeScenario({
      id: 's1',
      name: 'x'.repeat(SCENARIO_NAME_MAX + 10),
      loop: 'yes',
      tracks: [
        { key: 'A', keyframes: [{ atMs: 0, value: 1 }] },
        { key: 'A', keyframes: [{ atMs: 0, value: 2 }] },
        { key: 'B', keyframes: [] },
      ],
    });
    expect(scenario?.name).toHaveLength(SCENARIO_NAME_MAX);
    expect(scenario?.loop).toBe(false);
    expect(scenario?.tracks).toEqual([
      { key: 'A', keyframes: [{ atMs: 0, value: 1 }] },
    ]);
    expect(sanitizeScenario({ name: 'no id' })).toBeNull();
  });

  it('목록 — id 중복 첫 항목, 상한, 배열 아님은 빈 배열; 세트에 비면 생략', () => {
    const list = sanitizeScenarioList([
      { id: 'a', tracks: [] },
      { id: 'a', name: 'dup' },
      { id: 'b' },
    ]);
    expect(list.map((s) => s.id)).toEqual(['a', 'b']);
    expect(sanitizeScenarioList('x')).toEqual([]);
    expect(
      sanitizeScenarioList(
        Array.from({ length: SCENARIOS_MAX + 3 }, (_, i) => ({ id: `s${i}` })),
      ),
    ).toHaveLength(SCENARIOS_MAX);
    expect(
      sanitizeVirtualTagSet({ tags: [], scenarios: [] }),
    ).not.toHaveProperty('scenarios');
    expect(
      sanitizeVirtualTagSet({ tags: [], scenarios: [{ id: 's' }] }).scenarios,
    ).toHaveLength(1);
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
      sanitizeVirtualTag({ ...valid, limits: { maxSpeed: 1 } })?.limits,
    ).toEqual({
      maxSpeed: 1,
    });
    expect(sanitizeVirtualTag({ ...valid, limits: {} })).not.toHaveProperty(
      'limits',
    );
  });
});
