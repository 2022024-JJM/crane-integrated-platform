import { describe, expect, it } from 'vitest';
import { degToRad, numRound, radToDeg } from '../math-utils';

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
