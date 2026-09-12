import { describe, expect, it } from 'vitest';
import {
  WIND_CAUTION_MS,
  WIND_STOP_MS,
  compassPoint,
  formatClockHm,
  resolveWindAdvisory,
} from '../wind-advisory';

describe('resolveWindAdvisory', () => {
  it('경계 정확값은 상위 단계, 그 아래는 하위 단계', () => {
    expect(resolveWindAdvisory(0)).toBe('normal');
    expect(resolveWindAdvisory(WIND_CAUTION_MS - 0.01)).toBe('normal');
    expect(resolveWindAdvisory(WIND_CAUTION_MS)).toBe('caution');
    expect(resolveWindAdvisory(WIND_STOP_MS - 0.01)).toBe('caution');
    expect(resolveWindAdvisory(WIND_STOP_MS)).toBe('stop');
    expect(resolveWindAdvisory(40)).toBe('stop');
  });

  it('null·undefined·NaN·음수는 null', () => {
    expect(resolveWindAdvisory(null)).toBeNull();
    expect(resolveWindAdvisory(undefined)).toBeNull();
    expect(resolveWindAdvisory(NaN)).toBeNull();
    expect(resolveWindAdvisory(-1)).toBeNull();
  });
});

describe('compassPoint', () => {
  it('16방위 경계·랩', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(11.24)).toBe('N');
    expect(compassPoint(11.25)).toBe('NNE');
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(180)).toBe('S');
    expect(compassPoint(270)).toBe('W');
    expect(compassPoint(359.9)).toBe('N');
    expect(compassPoint(360)).toBe('N');
    expect(compassPoint(-90)).toBe('W');
    expect(compassPoint(720 + 45)).toBe('NE');
  });

  it('NaN·null 은 null', () => {
    expect(compassPoint(NaN)).toBeNull();
    expect(compassPoint(null)).toBeNull();
    expect(compassPoint(undefined)).toBeNull();
  });
});

describe('formatClockHm', () => {
  it('두 자리로 채우고 비정수는 null', () => {
    expect(formatClockHm(9, 5)).toBe('09:05');
    expect(formatClockHm(23, 59)).toBe('23:59');
    expect(formatClockHm(9.5, 0)).toBeNull();
    expect(formatClockHm(NaN, 0)).toBeNull();
  });
});
