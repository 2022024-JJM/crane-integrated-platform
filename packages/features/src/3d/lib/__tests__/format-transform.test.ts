import { describe, expect, it } from 'vitest';
import {
  displayRotationValue,
  formatPosition,
  formatRotation,
  formatScale,
} from '../format-transform';

describe('displayRotationValue', () => {
  it('[0,360) 값은 소수점 둘째자리에서 반올림만 하고 그대로 둔다', () => {
    expect(displayRotationValue(0)).toBe(0);
    expect(displayRotationValue(45)).toBe(45);
    expect(displayRotationValue(123.4567)).toBe(123.5);
    expect(displayRotationValue(45.64)).toBe(45.6);
    // 45.65 같은 이진 표현 모호값(45.6499…)은 피한다
    expect(displayRotationValue(45.66)).toBe(45.7);
  });

  it('음수·초과 각을 [0,360)으로 wrap한다', () => {
    expect(displayRotationValue(-30)).toBe(330);
    expect(displayRotationValue(370)).toBe(10);
    expect(displayRotationValue(360)).toBe(0);
  });

  it('반올림이 360에 도달하면 0으로 재정규화된다 (반올림→wrap 순서)', () => {
    expect(displayRotationValue(359.96)).toBe(0);
    expect(displayRotationValue(-360.04)).toBe(0);
  });

  it('-0 부근 반올림도 +0이 된다', () => {
    expect(Object.is(displayRotationValue(-0.0001), 0)).toBe(true);
    expect(Object.is(displayRotationValue(-0), 0)).toBe(true);
  });

  it('비유한값은 0으로 방어한다', () => {
    expect(displayRotationValue(Number.NaN)).toBe(0);
    expect(displayRotationValue(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('formatRotation', () => {
  it('각도 기호를 붙이고 소수점 둘째자리에서 반올림한다', () => {
    expect(formatRotation(45)).toBe('45°');
    expect(formatRotation(123.4567)).toBe('123.5°');
  });

  it('음수·경계값도 wrap된 값으로 표시한다', () => {
    expect(formatRotation(-30)).toBe('330°');
    expect(formatRotation(360)).toBe('0°');
    expect(formatRotation(359.96)).toBe('0°');
    expect(formatRotation(-0)).toBe('0°');
  });

  it('비유한값은 0°로 방어한다', () => {
    expect(formatRotation(Number.NaN)).toBe('0°');
  });
});

describe('formatPosition', () => {
  it('m 단위를 붙인다', () => {
    expect(formatPosition(1.5)).toBe('1.5 m');
    expect(formatPosition(0)).toBe('0 m');
    expect(formatPosition(-3.2)).toBe('-3.2 m');
  });

  it('소수점 3자리로 반올림한다', () => {
    expect(formatPosition(1.23456)).toBe('1.235 m');
  });

  it('비유한값은 0 m로 방어한다', () => {
    expect(formatPosition(Number.NaN)).toBe('0 m');
    expect(formatPosition(Number.POSITIVE_INFINITY)).toBe('0 m');
  });
});

describe('formatScale', () => {
  it('소수점 3자리 고정으로 표시한다', () => {
    expect(formatScale(1)).toBe('1.000');
    expect(formatScale(2.5)).toBe('2.500');
    expect(formatScale(100)).toBe('100.000');
  });

  it('3자리 초과는 반올림한다', () => {
    expect(formatScale(0.1234)).toBe('0.123');
    expect(formatScale(0.9999)).toBe('1.000');
  });

  it('비유한값은 0.000으로 방어한다', () => {
    expect(formatScale(Number.NaN)).toBe('0.000');
    expect(formatScale(Number.POSITIVE_INFINITY)).toBe('0.000');
  });
});
