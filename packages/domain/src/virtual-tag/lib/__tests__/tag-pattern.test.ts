import { describe, expect, it } from 'vitest';
import {
  clampToTag,
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
    key: 'C_1:x',
    name: 'x',
    min: 0,
    max: 100,
    initial: 0,
    enabled: true,
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
    expect(initVirtualTagState(def)).toEqual({ value: 100, rng: 0 });
  });

  it('random-walk 는 시드를 rng 상태로 삼는다', () => {
    expect(
      initVirtualTagState(tag({ kind: 'random-walk', stepPct: 5, seed: 42 })),
    ).toEqual({ value: 0, rng: 42 });
  });
});

describe('stepVirtualTag — 시간 파형', () => {
  it('triangle: 0 → max(반주기) → 0(한 주기), initial 이 시작점', () => {
    const def = tag({ kind: 'triangle', periodMs: 1000 });
    const s = initVirtualTagState(def);
    expect(stepVirtualTag(def, 0, s).value).toBe(0);
    expect(stepVirtualTag(def, 250, s).value).toBeCloseTo(50);
    expect(stepVirtualTag(def, 500, s).value).toBeCloseTo(100);
    expect(stepVirtualTag(def, 750, s).value).toBeCloseTo(50);
    expect(stepVirtualTag(def, 1000, s).value).toBeCloseTo(0);

    const fromMid = tag({ kind: 'triangle', periodMs: 1000 }, { initial: 50 });
    expect(stepVirtualTag(fromMid, 0, initVirtualTagState(fromMid)).value).toBeCloseTo(50);
    // 상승 중이어야 한다 — 초기값에서 점프 없이 이어진다.
    expect(stepVirtualTag(fromMid, 100, initVirtualTagState(fromMid)).value).toBeCloseTo(70);
  });

  it('sine: initial 에서 시작해 부드럽게 max 까지, 범위를 벗어나지 않는다', () => {
    const def = tag({ kind: 'sine', periodMs: 1000 }, { initial: 25 });
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
    const def = tag({ kind: 'sawtooth', periodMs: 1000 });
    const s = initVirtualTagState(def);
    expect(stepVirtualTag(def, 500, s).value).toBeCloseTo(50);
    expect(stepVirtualTag(def, 999, s).value).toBeCloseTo(99.9);
    expect(stepVirtualTag(def, 1000, s).value).toBeCloseTo(0);
  });

  it('square: duty 구간은 max, 나머지는 min. 기본 duty 50', () => {
    const def = tag({ kind: 'square', periodMs: 1000 });
    const s = initVirtualTagState(def);
    expect(stepVirtualTag(def, 0, s).value).toBe(100);
    expect(stepVirtualTag(def, 499, s).value).toBe(100);
    expect(stepVirtualTag(def, 500, s).value).toBe(0);
    const narrow = tag({ kind: 'square', periodMs: 1000, dutyPct: 10 });
    expect(stepVirtualTag(narrow, 99, s).value).toBe(100);
    expect(stepVirtualTag(narrow, 100, s).value).toBe(0);
  });

  it('음수·NaN elapsed 는 0 으로 본다', () => {
    const def = tag({ kind: 'sawtooth', periodMs: 1000 });
    const s = initVirtualTagState(def);
    expect(stepVirtualTag(def, -500, s).value).toBe(0);
    expect(stepVirtualTag(def, NaN, s).value).toBe(0);
  });

  it('시간 파형은 rng 상태를 건드리지 않는다', () => {
    const def = tag({ kind: 'triangle', periodMs: 1000 });
    expect(stepVirtualTag(def, 123, { value: 0, rng: 7 }).rng).toBe(7);
  });
});

describe('stepVirtualTag — manual / random-walk', () => {
  it('manual 은 상태를 그대로 돌려준다(같은 참조)', () => {
    const def = tag({ kind: 'manual' });
    const s = { value: 30, rng: 0 };
    expect(stepVirtualTag(def, 5000, s)).toBe(s);
  });

  it('manual 값 설정은 클램프하고, 같은 값이면 참조를 유지한다', () => {
    const def = tag({ kind: 'manual' });
    const s = { value: 30, rng: 0 };
    expect(setVirtualTagManualValue(def, s, 30)).toBe(s);
    expect(setVirtualTagManualValue(def, s, 500)).toEqual({ value: 100, rng: 0 });
    expect(setVirtualTagManualValue(def, s, NaN)).toEqual({ value: 0, rng: 0 });
  });

  it('random-walk 는 같은 시드면 같은 수열, 스텝은 stepPct 이내, 범위 클램프', () => {
    const def = tag({ kind: 'random-walk', stepPct: 5, seed: 99 }, { initial: 50 });
    let a = initVirtualTagState(def);
    let b = initVirtualTagState(def);
    for (let i = 0; i < 50; i++) {
      const na = stepVirtualTag(def, i * 100, a);
      const nb = stepVirtualTag(def, i * 100, b);
      expect(na).toEqual(nb);
      expect(Math.abs(na.value - a.value)).toBeLessThanOrEqual(5 + 1e-9);
      expect(na.value).toBeGreaterThanOrEqual(0);
      expect(na.value).toBeLessThanOrEqual(100);
      expect(na.rng).not.toBe(a.rng);
      a = na;
      b = nb;
    }
  });

  it('random-walk 는 시드가 다르면 수열이 달라진다', () => {
    const d1 = tag({ kind: 'random-walk', stepPct: 5, seed: 1 }, { initial: 50 });
    const d2 = tag({ kind: 'random-walk', stepPct: 5, seed: 2 }, { initial: 50 });
    const v1 = stepVirtualTag(d1, 0, initVirtualTagState(d1)).value;
    const v2 = stepVirtualTag(d2, 0, initVirtualTagState(d2)).value;
    expect(v1).not.toBe(v2);
  });
});
