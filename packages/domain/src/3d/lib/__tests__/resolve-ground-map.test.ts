import { describe, expect, it } from 'vitest';
import { isContextMap, resolveGroundMaps } from '../resolve-ground-map';
import type { SavedMapInfo } from '../../model/types';

const area1 = (id: string): SavedMapInfo => ({
  id,
  path: '/maps/philly-area-1.glb',
  role: 'ground',
});
const area2 = (id: string): SavedMapInfo => ({
  id,
  path: '/maps/philly-area-2.glb',
  role: 'ground',
});
const context = (id: string): SavedMapInfo => ({
  id,
  path: '/maps/philly-terrain.glb',
  role: 'context',
});
/** 역할이 없는 지도 — 라이브러리가 모르는 파일이거나 옛 저장본. */
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

  it('역할이 없는 지도는 ground 가 있으면 빠진다', () => {
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

  it('전부 역할이 없는 지도면 maps[0] 한 장', () => {
    const u = unknown('u');
    const result = resolveGroundMaps([u, unknown('v')]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(u);
  });

  it('판정은 경로가 아니라 role 이다 — 같은 경로라도 role 이 없으면 바닥이 아니다', () => {
    const noRole: SavedMapInfo = { id: 'n', path: '/maps/philly-area-1.glb' };
    const a = area1('a');
    expect(resolveGroundMaps([noRole, a]).map((m) => m.id)).toEqual(['a']);
  });

  it('모르는 role 값은 바닥으로 세지 않는다', () => {
    const odd = {
      id: 'odd',
      path: '/maps/x.glb',
      role: 'floor',
    } as unknown as SavedMapInfo;
    const a = area1('a');
    expect(resolveGroundMaps([odd, a]).map((m) => m.id)).toEqual(['a']);
  });

  it('입력 배열을 변경하지 않는다', () => {
    const input = [context('c'), area1('a')];
    const snapshot = [...input];
    resolveGroundMaps(input);
    expect(input).toEqual(snapshot);
    expect(input[0]).toBe(snapshot[0]);
  });
});

describe('isContextMap', () => {
  it('role 이 context 인 지도만 주변 지형이다', () => {
    expect(isContextMap(context('c'))).toBe(true);
    expect(isContextMap(area1('a'))).toBe(false);
  });

  it('역할이 없는 지도는 주변 지형이 아니다', () => {
    expect(isContextMap(unknown('u'))).toBe(false);
  });
});
