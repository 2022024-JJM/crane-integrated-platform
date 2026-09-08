import { describe, expect, it } from 'vitest';
import { degToRad, normalizeDegrees, numRound, radToDeg } from '../math-utils';

describe('numRound', () => {
  it('기본 3자리로 반올림한다', () => {
    expect(numRound(1.23456)).toBe(1.235);
    expect(numRound(-1.23456)).toBe(-1.235);
  });

  it('자릿수를 지정할 수 있다', () => {
    expect(numRound(1.23456, 1)).toBe(1.2);
    expect(numRound(1.25, 1)).toBe(1.3);
    expect(numRound(1.23456, 0)).toBe(1);
  });

  it('정수는 그대로 돌려준다', () => {
    expect(numRound(42)).toBe(42);
  });
});

describe('degToRad / radToDeg', () => {
  it('도 → 라디안 변환', () => {
    expect(degToRad(0)).toBe(0);
    expect(degToRad(180)).toBeCloseTo(Math.PI, 12);
    expect(degToRad(-90)).toBeCloseTo(-Math.PI / 2, 12);
  });

  it('라디안 → 도 변환', () => {
    expect(radToDeg(Math.PI)).toBeCloseTo(180, 12);
    expect(radToDeg(-Math.PI / 2)).toBeCloseTo(-90, 12);
  });

  it('왕복 변환이 원값을 보존한다', () => {
    expect(radToDeg(degToRad(37.5))).toBeCloseTo(37.5, 10);
  });
});

describe('normalizeDegrees', () => {
  it('[0,360) 범위 값은 그대로 돌려준다', () => {
    expect(normalizeDegrees(0)).toBe(0);
    expect(normalizeDegrees(45)).toBe(45);
    expect(normalizeDegrees(359.999)).toBe(359.999);
  });

  it('경계 정확값 360은 0으로, 그 초과는 wrap된다', () => {
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(360.001)).toBeCloseTo(0.001, 9);
    expect(normalizeDegrees(450)).toBe(90);
    expect(normalizeDegrees(720)).toBe(0);
  });

  it('음수 각은 양의 등가각으로 wrap된다', () => {
    expect(normalizeDegrees(-30)).toBe(330);
    expect(normalizeDegrees(-90)).toBe(270);
    expect(normalizeDegrees(-360)).toBe(0);
    expect(normalizeDegrees(-720)).toBe(0);
    expect(normalizeDegrees(-450)).toBe(270);
  });

  it('-0은 +0이 된다 ("-0°" 표시 방지)', () => {
    expect(Object.is(normalizeDegrees(-0), 0)).toBe(true);
  });

  it('범위 안 값은 부동소수점 오차 없이 정확히 보존된다 (이중 mod 회귀)', () => {
    // ((deg%360)+360)%360 구현은 45.7을 45.69999999999999로 만들었다
    expect(normalizeDegrees(45.7)).toBe(45.7);
    expect(normalizeDegrees(123.457)).toBe(123.457);
  });

  it('0에 극히 가까운 음수도 [0,360) 안으로 들어온다', () => {
    // -1e-13 + 360은 부동소수점상 정확히 360으로 붙는다 → 가드로 0
    const result = normalizeDegrees(-1e-13);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
  });

  it('비유한값은 0으로 방어한다', () => {
    expect(normalizeDegrees(Number.NaN)).toBe(0);
    expect(normalizeDegrees(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeDegrees(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});
