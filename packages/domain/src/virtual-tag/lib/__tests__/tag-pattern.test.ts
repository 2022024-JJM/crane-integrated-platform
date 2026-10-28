import { describe, expect, it } from 'vitest';
import {
  clampToTag,
  evaluateKeyframes,
  initVirtualTagState,
  setVirtualTagManualValue,
  stepVirtualTag,
} from '../tag-pattern';
import type {
  VirtualTagDefinition,
  VirtualTagPattern,
} from '../../model/types';

function tag(
  pattern: VirtualTagPattern,
  overrides: Partial<VirtualTagDefinition> = {},
): VirtualTagDefinition {
  return {
    id: 't1',
    code: 'x',
    name: 'x',
    dataType: 'number',
    min: 0,
    max: 100,
    initial: 0,
    pattern,
    ...overrides,
  };
}

describe('clampToTag / initVirtualTagState', () => {
  it('범위 밖·NaN 은 잘라내고, 초기 상태는 initial 을 클램프한 값', () => {
    const def = tag({ kind: 'manual' }, { initial: 250 });
    expect(clampToTag(def, -5)).toBe(0);
    expect(clampToTag(def, 100)).toBe(100);
    expect(clampToTag(def, 100.001)).toBe(100);
    expect(clampToTag(def, NaN)).toBe(0);
    expect(clampToTag(def, Infinity)).toBe(0); // 비유한수는 전부 min
    expect(initVirtualTagState(def)).toEqual({ value: 100 });
  });
});

describe('stepVirtualTag — 시간 파형', () => {
  it('triangle: 0 → max(반주기) → 0(한 주기), initial 이 시작점', () => {
    const def = tag({ kind: 'triangle', periodSec: 1 });
    const s = initVirtualTagState(def);
    expect(stepVirtualTag(def, 0, s).value).toBe(0);
    expect(stepVirtualTag(def, 250, s).value).toBeCloseTo(50);
    expect(stepVirtualTag(def, 500, s).value).toBeCloseTo(100);
    expect(stepVirtualTag(def, 750, s).value).toBeCloseTo(50);
    expect(stepVirtualTag(def, 1000, s).value).toBeCloseTo(0);

    const fromMid = tag({ kind: 'triangle', periodSec: 1 }, { initial: 50 });
    expect(
      stepVirtualTag(fromMid, 0, initVirtualTagState(fromMid)).value,
    ).toBeCloseTo(50);
    // 상승 중이어야 한다 — 초기값에서 점프 없이 이어진다.
    expect(
      stepVirtualTag(fromMid, 100, initVirtualTagState(fromMid)).value,
    ).toBeCloseTo(70);
  });

  it('sine: initial 에서 시작해 부드럽게 max 까지, 범위를 벗어나지 않는다', () => {
    const def = tag({ kind: 'sine', periodSec: 1 }, { initial: 25 });
    const s = initVirtualTagState(def);
    expect(stepVirtualTag(def, 0, s).value).toBeCloseTo(25);
    for (let ms = 0; ms <= 2000; ms += 37) {
      const v = stepVirtualTag(def, ms, s).value;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    // 반주기 뒤 최대(위상 이동 포함).
    const phaseMs = (Math.acos(1 - 2 * 0.25) / (2 * Math.PI)) * 1000;
    expect(stepVirtualTag(def, 500 - phaseMs, s).value).toBeCloseTo(100, 5);
  });

  it('sawtooth: 선형 상승 후 주기 끝에서 min 으로 되돌아간다', () => {
    const def = tag({ kind: 'sawtooth', periodSec: 1 });
    const s = initVirtualTagState(def);
    expect(stepVirtualTag(def, 500, s).value).toBeCloseTo(50);
    expect(stepVirtualTag(def, 999, s).value).toBeCloseTo(99.9);
    expect(stepVirtualTag(def, 1000, s).value).toBeCloseTo(0);
  });

  it('square: duty 구간은 max, 나머지는 min. 기본 duty 50', () => {
    const def = tag({ kind: 'square', periodSec: 1 });
    const s = initVirtualTagState(def);
    expect(stepVirtualTag(def, 0, s).value).toBe(100);
    expect(stepVirtualTag(def, 499, s).value).toBe(100);
    expect(stepVirtualTag(def, 500, s).value).toBe(0);
    const narrow = tag({ kind: 'square', periodSec: 1, dutyPct: 10 });
    expect(stepVirtualTag(narrow, 99, s).value).toBe(100);
    expect(stepVirtualTag(narrow, 100, s).value).toBe(0);
  });

  it('음수·NaN elapsed 는 0 으로 본다', () => {
    const def = tag({ kind: 'sawtooth', periodSec: 1 });
    const s = initVirtualTagState(def);
    expect(stepVirtualTag(def, -500, s).value).toBe(0);
    expect(stepVirtualTag(def, NaN, s).value).toBe(0);
  });
});

describe('stepVirtualTag — manual', () => {
  it('manual 은 상태를 그대로 돌려준다(같은 참조)', () => {
    const def = tag({ kind: 'manual' });
    const s = { value: 30 };
    expect(stepVirtualTag(def, 5000, s)).toBe(s);
  });

  it('manual 값 설정은 클램프하고, 같은 값이면 참조를 유지한다', () => {
    const def = tag({ kind: 'manual' });
    const s = { value: 30 };
    expect(setVirtualTagManualValue(def, s, 30)).toBe(s);
    expect(setVirtualTagManualValue(def, s, 500)).toEqual({ value: 100 });
    expect(setVirtualTagManualValue(def, s, NaN)).toEqual({ value: 0 });
  });
});

describe('keyframes', () => {
  const points = [
    { atSec: 0, value: 0 },
    { atSec: 10, value: 100 },
    { atSec: 20, value: 100 },
    { atSec: 30, value: 40 },
  ];

  it('점 사이는 선형 보간, 앞·뒤는 끝값 유지', () => {
    expect(evaluateKeyframes(points, -5, false, false)).toBe(0);
    expect(evaluateKeyframes(points, 0, false, false)).toBe(0);
    expect(evaluateKeyframes(points, 5, false, false)).toBe(50);
    expect(evaluateKeyframes(points, 15, false, false)).toBe(100);
    expect(evaluateKeyframes(points, 25, false, false)).toBe(70);
    expect(evaluateKeyframes(points, 30, false, false)).toBe(40);
    expect(evaluateKeyframes(points, 1000, false, false)).toBe(40);
  });

  it('loop 는 마지막 점 시각을 주기로 되감는다 — 경계 정확값은 0 초', () => {
    expect(evaluateKeyframes(points, 30, true, false)).toBe(0);
    expect(evaluateKeyframes(points, 35, true, false)).toBe(50);
    expect(evaluateKeyframes(points, 65, true, false)).toBe(50);
    // 마지막 시각이 0 이면 되감지 않는다(0 으로 나누기 없음)
    expect(evaluateKeyframes([{ atSec: 0, value: 7 }], 99, true, false)).toBe(
      7,
    );
  });

  it('step 은 앞 점의 값을 유지한다(불리언)', () => {
    expect(evaluateKeyframes(points, 5, false, true)).toBe(0);
    expect(evaluateKeyframes(points, 9.999, false, true)).toBe(0);
    expect(evaluateKeyframes(points, 10, false, true)).toBe(100);
    expect(evaluateKeyframes(points, 29.9, false, true)).toBe(100);
  });

  it('점이 없으면 0, NaN 시각은 0 초로', () => {
    expect(evaluateKeyframes([], 5, true, false)).toBe(0);
    expect(evaluateKeyframes(points, Number.NaN, false, false)).toBe(0);
  });

  it('stepVirtualTag — 숫자는 보간·클램프, 불리언은 계단', () => {
    const num = tag(
      { kind: 'keyframes', points, loop: true },
      { min: 0, max: 80, initial: 0 },
    );
    const state = initVirtualTagState(num);
    expect(stepVirtualTag(num, 5_000, state).value).toBe(50);
    expect(stepVirtualTag(num, 15_000, state).value).toBe(80); // 범위로 클램프
    expect(stepVirtualTag(num, 35_000, state).value).toBe(50); // loop
    const bool = tag(
      {
        kind: 'keyframes',
        points: [
          { atSec: 0, value: 0 },
          { atSec: 3, value: 1 },
          { atSec: 6, value: 0 },
        ],
      },
      { dataType: 'bool', min: 0, max: 1, initial: 0 },
    );
    expect(stepVirtualTag(bool, 2_999, state).value).toBe(0);
    expect(stepVirtualTag(bool, 3_000, state).value).toBe(1);
    expect(stepVirtualTag(bool, 5_999, state).value).toBe(1);
    expect(stepVirtualTag(bool, 6_000, state).value).toBe(0);
    expect(stepVirtualTag(bool, 60_000, state).value).toBe(0); // loop 없음: 끝값
  });
});

describe('keyframes — smooth 가감속', () => {
  const points = [
    { atSec: 0, value: 0 },
    { atSec: 10, value: 100 },
  ];
  it('구간 중앙은 같고 초입·말미는 선형보다 느리며 끝점은 정확', () => {
    expect(evaluateKeyframes(points, 5, false, false, true)).toBe(50);
    expect(evaluateKeyframes(points, 2, false, false, true)).toBeCloseTo(10.4);
    expect(evaluateKeyframes(points, 8, false, false, true)).toBeCloseTo(89.6);
    expect(evaluateKeyframes(points, 0, false, false, true)).toBe(0);
    expect(evaluateKeyframes(points, 10, false, false, true)).toBe(100);
  });
  it('계단(불리언)에는 영향이 없다', () => {
    expect(evaluateKeyframes(points, 5, false, true, true)).toBe(0);
  });
  it('stepVirtualTag 가 pattern.ease 를 넘긴다', () => {
    const def = tag({ kind: 'keyframes', points, ease: 'smooth' });
    expect(
      stepVirtualTag(def, 2_000, initVirtualTagState(def)).value,
    ).toBeCloseTo(10.4);
  });
});
