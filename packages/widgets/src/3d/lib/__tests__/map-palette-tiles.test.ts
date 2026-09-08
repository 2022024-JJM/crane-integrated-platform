import { describe, expect, it } from 'vitest';
import type { SavedMapInfo, SceneMapCatalogItem } from '@crane/domain/3d';
import { sceneMapCatalog } from '@crane/domain/3d';
import { getMapPaletteTiles } from '../map-palette-tiles';

const catalog: SceneMapCatalogItem[] = [
  { id: 'a', label: 'A', path: '/maps/a.glb', kind: 'ground' },
  { id: 'b', label: 'B', path: '/maps/b.glb', kind: 'context' },
];

describe('getMapPaletteTiles', () => {
  it('지도가 없으면(undefined·빈 배열) 전부 미배치·잠금 해제, 카탈로그 순서', () => {
    for (const maps of [undefined, null, []] as const) {
      const tiles = getMapPaletteTiles(maps, catalog);
      expect(tiles.map((t) => t.item.id)).toEqual(['a', 'b']);
      expect(tiles.every((t) => t.placed === null && !t.locked)).toBe(true);
    }
  });

  it('놓인 지도는 같은 참조로 붙고 locked 는 반전 기본값을 따른다', () => {
    const absent: SavedMapInfo = { id: 'm1', path: '/maps/a.glb' };
    const unlocked: SavedMapInfo = {
      id: 'm2',
      path: '/maps/b.glb',
      locked: false,
    };
    const [a, b] = getMapPaletteTiles([absent, unlocked], catalog);
    expect(a.placed).toBe(absent);
    expect(a.locked).toBe(true);
    expect(b.placed).toBe(unlocked);
    expect(b.locked).toBe(false);

    const [explicit] = getMapPaletteTiles(
      [{ id: 'm3', path: '/maps/a.glb', locked: true }],
      catalog,
    );
    expect(explicit.locked).toBe(true);
  });

  it('같은 경로가 여러 장이면 첫 항목이 대표', () => {
    const first: SavedMapInfo = { id: 'f', path: '/maps/a.glb', locked: false };
    const second: SavedMapInfo = { id: 's', path: '/maps/a.glb' };
    const [a] = getMapPaletteTiles([first, second], catalog);
    expect(a.placed).toBe(first);
    expect(a.locked).toBe(false);
  });

  it('카탈로그에 없는 경로의 지도는 타일을 만들지 않는다', () => {
    const tiles = getMapPaletteTiles(
      [{ id: 'x', path: '/maps/unknown.glb' }],
      catalog,
    );
    expect(tiles).toHaveLength(2);
    expect(tiles.every((t) => t.placed === null)).toBe(true);
  });

  it('카탈로그를 생략하면 실제 sceneMapCatalog 를 쓴다', () => {
    const tiles = getMapPaletteTiles([]);
    expect(tiles.map((t) => t.item)).toEqual(sceneMapCatalog);
  });
});
