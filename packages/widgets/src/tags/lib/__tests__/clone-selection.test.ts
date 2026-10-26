import { describe, expect, it } from 'vitest';
import {
  groupSelectionState,
  resolveSelectedCodes,
  setSelectedCodes,
  toggleSelectedCode,
} from '../clone-selection';

const all = ['a', 'b', 'c'];

describe('clone-selection', () => {
  it('null 은 전부 선택이고, 토글은 새 집합을 돌려준다', () => {
    expect([...resolveSelectedCodes(null, all)]).toEqual(all);
    const some = new Set(['a']);
    expect(resolveSelectedCodes(some, all)).not.toBe(some);
    expect([...toggleSelectedCode(null, all, 'b')]).toEqual(['a', 'c']);
    expect([...toggleSelectedCode(new Set(['a']), all, 'b')]).toEqual([
      'a',
      'b',
    ]);
    expect([...toggleSelectedCode(new Set(['a']), all, 'a')]).toEqual([]);
  });

  it('묶음 켜고 끄기 — 목록에 없는 코드는 그대로 남는다', () => {
    expect([...setSelectedCodes(null, all, ['a', 'b'], false)]).toEqual(['c']);
    expect([...setSelectedCodes(new Set(), all, ['a'], true)]).toEqual(['a']);
    expect([...setSelectedCodes(new Set(['z']), all, ['a'], true)]).toEqual([
      'z',
      'a',
    ]);
    expect([...setSelectedCodes(null, all, [], false)]).toEqual(all);
  });

  it('묶음 상태 — 전부·일부·없음, 빈 묶음은 none', () => {
    expect(groupSelectionState(new Set(all), ['a', 'b'])).toBe('all');
    expect(groupSelectionState(new Set(['a']), ['a', 'b'])).toBe('some');
    expect(groupSelectionState(new Set(), ['a', 'b'])).toBe('none');
    expect(groupSelectionState(new Set(all), [])).toBe('none');
  });
});
