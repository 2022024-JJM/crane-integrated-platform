import { describe, expect, it } from 'vitest';
import {
  CONTOUR_MAX_DISTANCE_M,
  isSameIdList,
  selectContourIds,
} from '../contour-culling';

describe('selectContourIds', () => {
  it('m 상한을 unit 으로 환산해 그 안의 id 만, 입력 순서 유지, 비유한 거리는 제외', () => {
    const c = [
      { id: 'a', distance: 10 },
      { id: 'b', distance: CONTOUR_MAX_DISTANCE_M },
      { id: 'c', distance: CONTOUR_MAX_DISTANCE_M + 1 },
      { id: 'd', distance: NaN },
    ];
    expect(selectContourIds(c, 1)).toEqual(['a', 'b']);
    // 11.7 m/unit 씬: 상한이 unit 으로 짧아진다.
    expect(selectContourIds(c, 11.7)).toEqual(['a']);
    expect(selectContourIds(c, 0)).toEqual(['a', 'b']);
  });
});

describe('isSameIdList', () => {
  it('길이·순서·내용이 같을 때만 true', () => {
    expect(isSameIdList(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(isSameIdList(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(isSameIdList([], [])).toBe(true);
    expect(isSameIdList(['a'], [])).toBe(false);
  });
});
