import { describe, expect, it } from 'vitest';
import { resolveReplaySmoothTime } from '../replay-smoothing';

const FALLBACK = 5000;

describe('resolveReplaySmoothTime', () => {
  it('들어가는 프레임의 길이 ÷ 배속을 초로 — 1초 프레임·1배속은 1초, 4배속은 0.25초', () => {
    expect(resolveReplaySmoothTime([1000, 1000, 1000], 1, 1, FALLBACK)).toBe(1);
    expect(resolveReplaySmoothTime([1000, 1000, 1000], 1, 4, FALLBACK)).toBe(
      0.25,
    );
    expect(resolveReplaySmoothTime([1000, 2000, 3000], 2, 0.5, FALLBACK)).toBe(
      6,
    );
  });

  it('프레임마다 길이가 다르면 들어가는 프레임의 길이를 쓴다', () => {
    expect(resolveReplaySmoothTime([1000, 2000, 3000], 1, 1, FALLBACK)).toBe(2);
    expect(resolveReplaySmoothTime([1000, 2000, 3000], 2, 1, FALLBACK)).toBe(3);
  });

  it('마지막 프레임(길이 0)에 닿을 때는 직전 프레임 길이 — 자세가 점프하지 않는다', () => {
    expect(resolveReplaySmoothTime([1000, 1000, 0], 2, 1, FALLBACK)).toBe(1);
    expect(resolveReplaySmoothTime([1000, 1000, 0], 2, 2, FALLBACK)).toBe(0.5);
  });

  it('길이가 비유한·음수·결손이면 직전 길이, 직전도 없으면 기본 길이', () => {
    expect(resolveReplaySmoothTime([1000, NaN], 1, 1, FALLBACK)).toBe(1);
    expect(resolveReplaySmoothTime([1000, -5], 1, 1, FALLBACK)).toBe(1);
    expect(resolveReplaySmoothTime([0, 0], 1, 1, FALLBACK)).toBe(5);
    expect(resolveReplaySmoothTime([], 0, 1, FALLBACK)).toBe(5);
    expect(resolveReplaySmoothTime([1000], 5, 1, FALLBACK)).toBe(5);
  });

  it('기본 길이까지 못 쓰면 undefined = 소비자 기본', () => {
    expect(resolveReplaySmoothTime([0], 0, 1, 0)).toBeUndefined();
    expect(resolveReplaySmoothTime([0], 0, 1, NaN)).toBeUndefined();
  });

  it('배속이 0·음수·비유한이면 undefined = 소비자 기본', () => {
    expect(resolveReplaySmoothTime([1000], 0, 0, FALLBACK)).toBeUndefined();
    expect(resolveReplaySmoothTime([1000], 0, -1, FALLBACK)).toBeUndefined();
    expect(resolveReplaySmoothTime([1000], 0, NaN, FALLBACK)).toBeUndefined();
    expect(
      resolveReplaySmoothTime([1000], 0, Infinity, FALLBACK),
    ).toBeUndefined();
  });
});
