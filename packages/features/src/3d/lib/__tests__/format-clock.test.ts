import { describe, expect, it } from 'vitest';
import { formatClock, formatTagNumber, resolveAge } from '../format-clock';

describe('formatClock', () => {
  it('로컬 시·분·초·밀리초를 두 자리·세 자리로 채운다', () => {
    const ms = new Date(2026, 9, 20, 4, 5, 6, 7).getTime();
    expect(formatClock(ms)).toBe('04:05:06.007');
  });

  it('null · undefined · NaN · Infinity 는 대시', () => {
    expect(formatClock(null)).toBe('—');
    expect(formatClock(undefined)).toBe('—');
    expect(formatClock(Number.NaN)).toBe('—');
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('resolveAge', () => {
  it('10초 미만은 소수 한 자리 초', () => {
    expect(resolveAge(0)).toEqual({ unit: 'seconds', value: '0.0' });
    expect(resolveAge(340)).toEqual({ unit: 'seconds', value: '0.3' });
    expect(resolveAge(9_999)).toEqual({ unit: 'seconds', value: '10.0' });
  });

  it('10초 이상 1분 미만은 정수 초(내림)', () => {
    expect(resolveAge(10_000)).toEqual({ unit: 'seconds', value: '10' });
    expect(resolveAge(59_999)).toEqual({ unit: 'seconds', value: '59' });
  });

  it('1분부터는 분·초', () => {
    expect(resolveAge(60_000)).toEqual({
      unit: 'minutes',
      minutes: 1,
      seconds: 0,
    });
    expect(resolveAge(125_500)).toEqual({
      unit: 'minutes',
      minutes: 2,
      seconds: 5,
    });
  });

  it('음수·NaN 은 0 으로 본다', () => {
    expect(resolveAge(-5_000)).toEqual({ unit: 'seconds', value: '0.0' });
    expect(resolveAge(Number.NaN)).toEqual({ unit: 'seconds', value: '0.0' });
  });
});

describe('formatTagNumber', () => {
  it('천 단위 구분, 소수 유지', () => {
    expect(formatTagNumber(1743)).toBe('1,743');
    expect(formatTagNumber(12.5)).toBe('12.5');
    expect(formatTagNumber(0)).toBe('0');
  });

  it('grouped=false 면 구분 없이(연도·상태 비트)', () => {
    expect(formatTagNumber(2026, false)).toBe('2026');
    expect(formatTagNumber(12.5, false)).toBe('12.5');
  });

  it('유한하지 않은 값은 문자열 그대로', () => {
    expect(formatTagNumber(Number.NaN)).toBe('NaN');
    expect(formatTagNumber(Number.POSITIVE_INFINITY)).toBe('Infinity');
  });
});
