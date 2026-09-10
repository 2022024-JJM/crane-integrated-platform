import { describe, expect, it } from 'vitest';
import { resolveGroundMaps } from '../resolve-ground-map';
import type { SavedMapInfo } from '../../model/types';

const area1 = (id: string): SavedMapInfo => ({
  id,
  path: '/maps/philly-area-1.glb',
});
const area2 = (id: string): SavedMapInfo => ({
  id,
  path: '/maps/philly-area-2.glb',
});
const context = (id: string): SavedMapInfo => ({
  id,
  path: '/maps/philly-terrain.glb',
});
const unknown = (id: string): SavedMapInfo => ({ id, path: '/maps/none.glb' });

describe('resolveGroundMaps', () => {
  it('undefined·null·빈 배열이면 빈 배열이고 같은 공유 참조다', () => {
    const empty = resolveGroundMaps(undefined);
    expect(empty).toEqual([]);
    expect(resolveGroundMaps(null)).toBe(empty);
    expect(resolveGroundMaps([])).toBe(empty);
  });

  it('공유 빈 배열은 동결돼 호출부가 오염시킬 수 없다', () => {
    expect(Object.isFrozen(resolveGroundMaps(undefined))).toBe(true);
  });

  it('ground 지도 한 장이면 그 항목을 같은 참조로 돌려준다', () => {
    const g = area1('g');
    const result = resolveGroundMaps([g]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(g);
  });

  it('ground 가 여럿이면 전부를 입력 순서대로 돌려준다 (분할 지도)', () => {
    const b = area2('b');
    const a = area1('a');
    const result = resolveGroundMaps([b, a]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(b);
    expect(result[1]).toBe(a);
  });

  it('context 는 앞·사이·뒤 어디에 있어도 빠진다 (배열 순서 무관)', () => {
    const a = area1('a');
    const b = area2('b');
    const result = resolveGroundMaps([
      context('c1'),
      a,
      context('c2'),
      b,
      context('c3'),
    ]);
    expect(result.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('카탈로그에 없는 경로는 ground 가 있으면 빠진다', () => {
    const g = area1('g');
    const result = resolveGroundMaps([unknown('u'), g, unknown('v')]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(g);
  });

  it('context 만 있으면 maps[0] 한 장으로 폴백', () => {
    const c = context('c');
    const result = resolveGroundMaps([c, context('d')]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(c);
  });

  it('전부 카탈로그에 없는 경로면 maps[0] 한 장', () => {
    const u = unknown('u');
    const result = resolveGroundMaps([u, unknown('v')]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(u);
  });

  it('은퇴한 옛 조선소 경로(phillyshipyard.glb)는 더 이상 ground 가 아니다', () => {
    const old: SavedMapInfo = { id: 'old', path: '/maps/phillyshipyard.glb' };
    const a = area1('a');
    expect(resolveGroundMaps([old, a]).map((m) => m.id)).toEqual(['a']);
  });

  it('입력 배열을 변경하지 않는다', () => {
    const input = [context('c'), area1('a')];
    const snapshot = [...input];
    resolveGroundMaps(input);
    expect(input).toEqual(snapshot);
    expect(input[0]).toBe(snapshot[0]);
  });
});
