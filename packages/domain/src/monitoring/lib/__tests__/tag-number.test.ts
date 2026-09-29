import { describe, expect, it } from 'vitest';
import { toTagNumber } from '../tag-number';

describe('toTagNumber', () => {
  it('유한수는 그대로 — 0·음수·소수 포함', () => {
    expect(toTagNumber(0)).toBe(0);
    expect(toTagNumber(-12.5)).toBe(-12.5);
    expect(toTagNumber(1)).toBe(1);
  });

  it('NaN·Infinity 는 버린다', () => {
    expect(toTagNumber(Number.NaN)).toBeNull();
    expect(toTagNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(toTagNumber(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('boolean 은 1/0', () => {
    expect(toTagNumber(true)).toBe(1);
    expect(toTagNumber(false)).toBe(0);
  });

  it("문자열은 'true'/'false' 만 — 대소문자·앞뒤 공백 무시", () => {
    expect(toTagNumber('true')).toBe(1);
    expect(toTagNumber('false')).toBe(0);
    expect(toTagNumber('TRUE')).toBe(1);
    expect(toTagNumber('  False ')).toBe(0);
  });

  it('숫자 문자열·그 밖의 문자열은 버린다', () => {
    expect(toTagNumber('12')).toBeNull();
    expect(toTagNumber('0')).toBeNull();
    expect(toTagNumber('1')).toBeNull();
    expect(toTagNumber('ON')).toBeNull();
    expect(toTagNumber('not-a-number')).toBeNull();
    expect(toTagNumber('')).toBeNull();
    expect(toTagNumber('   ')).toBeNull();
  });

  it('null·undefined·객체·배열은 버린다', () => {
    expect(toTagNumber(null)).toBeNull();
    expect(toTagNumber(undefined)).toBeNull();
    expect(toTagNumber({ value: 1 })).toBeNull();
    expect(toTagNumber([1])).toBeNull();
  });
});
