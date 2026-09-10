import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_ARC_RADIUS,
  countdownArc,
  formatLeadTimeSec,
} from '../prediction-visual';

describe('countdownArc', () => {
  const circumference = 2 * Math.PI * COUNTDOWN_ARC_RADIUS;

  it('처음에는 원을 가득 채우고 0 이 되면 비운다', () => {
    expect(countdownArc(5, 5).dash).toBeCloseTo(circumference, 6);
    expect(countdownArc(0, 5).dash).toBeCloseTo(0, 6);
  });

  it('절반 남으면 절반만 채운다', () => {
    const { dash, gap } = countdownArc(2.5, 5);
    expect(dash).toBeCloseTo(circumference / 2, 6);
    expect(dash + gap).toBeCloseTo(circumference, 6);
  });

  it('처음보다 커진 리드타임(새 쌍 직전 요동)은 가득으로 클램프한다', () => {
    expect(countdownArc(99, 5).dash).toBeCloseTo(circumference, 6);
  });

  it('음수 리드타임은 빈 호다', () => {
    expect(countdownArc(-3, 5).dash).toBeCloseTo(0, 6);
  });

  it('분모가 0·음수·NaN 이어도 0 나눗셈이 새지 않는다', () => {
    for (const denom of [0, -1, Number.NaN]) {
      const { dash, gap } = countdownArc(1, denom);
      expect(Number.isFinite(dash)).toBe(true);
      expect(dash + gap).toBeCloseTo(circumference, 6);
    }
  });
});

describe('formatLeadTimeSec', () => {
  it('항상 소수 한 자리 — 정수도 폭이 같다', () => {
    expect(formatLeadTimeSec(3)).toBe('3.0');
    expect(formatLeadTimeSec(3.2)).toBe('3.2');
    expect(formatLeadTimeSec(10)).toBe('10.0');
  });

  it('반올림 경계', () => {
    expect(formatLeadTimeSec(0.04)).toBe('0.0');
    expect(formatLeadTimeSec(0.05)).toBe('0.1');
  });

  it('음수·NaN 은 0.0', () => {
    expect(formatLeadTimeSec(-1)).toBe('0.0');
    expect(formatLeadTimeSec(Number.NaN)).toBe('0.0');
    expect(formatLeadTimeSec(Number.POSITIVE_INFINITY)).toBe('0.0');
  });
});
