import { describe, expect, it } from 'vitest';
import { withPivotAxis } from '../rig-pivot';

describe('withPivotAxis', () => {
  it('한 성분만 바꾼다', () => {
    expect(withPivotAxis([1, 2, 3], 'y', 9)).toEqual([1, 9, 3]);
  });

  it('비어 있던 피벗에 한 성분을 넣으면 나머지는 0', () => {
    expect(withPivotAxis(undefined, 'z', -2.5)).toEqual([0, 0, -2.5]);
  });

  it('세 성분이 전부 비면 피벗을 없앤다', () => {
    expect(withPivotAxis([0, 0, 4], 'z', undefined)).toBeUndefined();
    expect(withPivotAxis(undefined, 'x', undefined)).toBeUndefined();
  });

  it('비유한수는 비운 것으로 본다', () => {
    expect(withPivotAxis([1, 2, 3], 'x', Number.NaN)).toEqual([0, 2, 3]);
  });

  it('입력 배열을 바꾸지 않는다', () => {
    const p: [number, number, number] = [1, 2, 3];
    withPivotAxis(p, 'x', 7);
    expect(p).toEqual([1, 2, 3]);
  });
});
