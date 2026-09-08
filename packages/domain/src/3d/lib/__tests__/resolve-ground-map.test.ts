import { describe, expect, it } from 'vitest';
import { resolveGroundMap } from '../resolve-ground-map';
import type { SavedMapInfo } from '../../model/types';

const ground = (id: string): SavedMapInfo => ({
  id,
  path: '/maps/phillyshipyard.glb',
});
const context = (id: string): SavedMapInfo => ({
  id,
  path: '/maps/philly-terrain.glb',
});
const unknown = (id: string): SavedMapInfo => ({ id, path: '/maps/none.glb' });

describe('resolveGroundMap', () => {
  it('undefined·null·빈 배열이면 null', () => {
    expect(resolveGroundMap(undefined)).toBeNull();
    expect(resolveGroundMap(null)).toBeNull();
    expect(resolveGroundMap([])).toBeNull();
  });

  it('ground 지도 한 장이면 그 항목을 같은 참조로 돌려준다', () => {
    const g = ground('g');
    expect(resolveGroundMap([g])).toBe(g);
  });

  it('context 가 앞에 있어도 ground 를 고른다 (배열 순서 무관)', () => {
    const g = ground('g');
    expect(resolveGroundMap([context('c'), g])).toBe(g);
  });

  it('ground 가 여럿이면 첫 항목', () => {
    const a = ground('a');
    expect(resolveGroundMap([a, ground('b')])).toBe(a);
  });

  it('context 만 있으면 maps[0] 으로 폴백', () => {
    const c = context('c');
    expect(resolveGroundMap([c, context('d')])).toBe(c);
  });

  it('카탈로그에 없는 경로가 앞에 있어도 ground 를 고른다', () => {
    const g = ground('g');
    expect(resolveGroundMap([unknown('u'), g])).toBe(g);
  });

  it('전부 카탈로그에 없는 경로면 maps[0]', () => {
    const u = unknown('u');
    expect(resolveGroundMap([u, unknown('v')])).toBe(u);
  });
});
