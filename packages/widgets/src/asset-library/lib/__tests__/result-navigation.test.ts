// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  findNeighbors,
  rangeBetween,
  readResultOrder,
  RESULT_ORDER_MAX,
  RESULT_ORDER_STORAGE_KEY,
  stepFromRemembered,
  stepInList,
  writeResultOrder,
} from '../result-navigation';

const ids = ['a', 'b', 'c', 'd'];

describe('stepInList', () => {
  it('앞뒤로 옮기고 끝에서 멈춘다', () => {
    expect(stepInList(ids, 'b', 1)).toBe('c');
    expect(stepInList(ids, 'b', -1)).toBe('a');
    expect(stepInList(ids, 'd', 1)).toBe('d');
    expect(stepInList(ids, 'a', -1)).toBe('a');
    expect(stepInList(ids, 'a', 99)).toBe('d');
  });

  it('출발점이 없거나 목록에 없으면 방향에 따라 첫·끝 항목', () => {
    expect(stepInList(ids, null, 1)).toBe('a');
    expect(stepInList(ids, null, -1)).toBe('d');
    expect(stepInList(ids, 'zzz', 1)).toBe('a');
  });

  it('빈 목록은 null', () => {
    expect(stepInList([], 'a', 1)).toBeNull();
  });
});

describe('rangeBetween', () => {
  it('양 끝을 포함하고 방향을 가리지 않는다', () => {
    expect(rangeBetween(ids, 'a', 'c')).toEqual(['a', 'b', 'c']);
    expect(rangeBetween(ids, 'd', 'b')).toEqual(['b', 'c', 'd']);
    expect(rangeBetween(ids, 'b', 'b')).toEqual(['b']);
  });

  it('기준점이 없으면 대상 하나, 대상이 없으면 빈 목록', () => {
    expect(rangeBetween(ids, null, 'c')).toEqual(['c']);
    expect(rangeBetween(ids, 'zzz', 'c')).toEqual(['c']);
    expect(rangeBetween(ids, 'a', 'zzz')).toEqual([]);
  });
});

describe('findNeighbors', () => {
  it('가운데·양 끝', () => {
    expect(findNeighbors(ids, 'b')).toEqual({
      previousId: 'a',
      nextId: 'c',
      position: 2,
      total: 4,
    });
    expect(findNeighbors(ids, 'a').previousId).toBeNull();
    expect(findNeighbors(ids, 'd').nextId).toBeNull();
  });

  it('목록에 없으면 이웃이 없고 위치 0', () => {
    expect(findNeighbors(ids, 'zzz')).toEqual({
      previousId: null,
      nextId: null,
      position: 0,
      total: 4,
    });
    expect(findNeighbors([], 'a').total).toBe(0);
  });
});

describe('결과 순서 기억', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('쓴 것을 그대로 읽는다', () => {
    writeResultOrder(ids, '?kind=model');
    expect(readResultOrder()).toEqual({ ids, search: '?kind=model' });
  });

  it('없으면 빈 순서', () => {
    expect(readResultOrder()).toEqual({ ids: [], search: '' });
  });

  it('상한까지만 기억한다', () => {
    const many = Array.from({ length: RESULT_ORDER_MAX + 1 }, (_, i) => `a${i}`);
    writeResultOrder(many, '');
    expect(readResultOrder().ids).toHaveLength(RESULT_ORDER_MAX);
  });

  it('손상된 값·오염된 타입은 버린다', () => {
    window.sessionStorage.setItem(RESULT_ORDER_STORAGE_KEY, '{oops');
    expect(readResultOrder()).toEqual({ ids: [], search: '' });
    window.sessionStorage.setItem(
      RESULT_ORDER_STORAGE_KEY,
      JSON.stringify({ ids: ['a', 3, null, 'b'], search: 'javascript:x' }),
    );
    expect(readResultOrder()).toEqual({ ids: ['a', 'b'], search: '' });
    window.sessionStorage.setItem(
      RESULT_ORDER_STORAGE_KEY,
      JSON.stringify({ ids: 'abc' }),
    );
    expect(readResultOrder().ids).toEqual([]);
  });
});

describe('stepFromRemembered', () => {
  it('목록에 있는 항목이면 stepInList 와 같다', () => {
    expect(stepFromRemembered(ids, 'b', 99, 1)).toBe('c');
    expect(stepFromRemembered(ids, 'b', 99, -1)).toBe('a');
  });

  it('목록에서 빠진 항목은 기억한 자리에서 이어 간다', () => {
    // 원래 [a, X, b, c, d] 의 X(자리 1)가 빠진 상황.
    expect(stepFromRemembered(ids, 'x', 1, 1)).toBe('b');
    expect(stepFromRemembered(ids, 'x', 1, -1)).toBe('a');
  });

  it('끝자리·맨 앞에서 빠졌을 때 범위를 벗어나지 않는다', () => {
    expect(stepFromRemembered(ids, 'x', 4, 1)).toBe('d');
    expect(stepFromRemembered(ids, 'x', 0, -1)).toBe('a');
    expect(stepFromRemembered(ids, 'x', 0, 1)).toBe('a');
  });

  it('기억한 자리가 비정상이면 맨 앞에서 시작한다', () => {
    expect(stepFromRemembered(ids, null, Number.NaN, 1)).toBe('a');
    expect(stepFromRemembered(ids, null, -5, 1)).toBe('a');
  });

  it('빈 목록은 null', () => {
    expect(stepFromRemembered([], 'x', 0, 1)).toBeNull();
  });
});
