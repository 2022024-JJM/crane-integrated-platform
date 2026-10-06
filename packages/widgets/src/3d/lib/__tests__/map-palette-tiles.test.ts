import { describe, expect, it } from 'vitest';
import type { SavedMapInfo } from '@crane/domain/3d';
import type { ScenePaletteMap } from '@crane/features/asset-library';
import { getMapPaletteTiles } from '../map-palette-tiles';

function entry(
  id: string,
  patch: Partial<ScenePaletteMap> = {},
): ScenePaletteMap {
  return {
    item: {
      id,
      version: 1,
      label: id.toUpperCase(),
      path: `/maps/${id}.glb`,
      role: 'ground',
    },
    status: 'published',
    blocked: null,
    thumbnail: null,
    ...patch,
  };
}

const entries = [entry('a'), entry('b')];

/** 자산 참조를 가진 지도. */
function placed(
  id: string,
  assetId: string,
  patch: Partial<SavedMapInfo> = {},
): SavedMapInfo {
  return {
    id,
    path: `/maps/${assetId}.glb`,
    asset: { id: assetId, version: 1 },
    ...patch,
  };
}

describe('getMapPaletteTiles', () => {
  it('지도가 없으면(undefined·null·빈 배열) 전부 미배치·잠금 해제, 팔레트 순서', () => {
    for (const maps of [undefined, null, []] as const) {
      const tiles = getMapPaletteTiles(maps, entries);
      expect(tiles.map((t) => t.entry.item.id)).toEqual(['a', 'b']);
      expect(tiles.every((t) => t.placed === null && !t.locked)).toBe(true);
    }
  });

  it('팔레트가 비어 있으면 타일도 없다', () => {
    expect(getMapPaletteTiles([placed('m', 'a')], [])).toEqual([]);
  });

  it('팔레트 항목을 같은 참조로 싣는다', () => {
    const tiles = getMapPaletteTiles([], entries);
    expect(tiles[0].entry).toBe(entries[0]);
  });

  it('놓인 지도는 같은 참조로 붙고 locked 는 반전 기본값을 따른다', () => {
    const absent = placed('m1', 'a');
    const unlocked = placed('m2', 'b', { locked: false });
    const [a, b] = getMapPaletteTiles([absent, unlocked], entries);
    expect(a.placed).toBe(absent);
    expect(a.locked).toBe(true);
    expect(b.placed).toBe(unlocked);
    expect(b.locked).toBe(false);

    const [explicit] = getMapPaletteTiles(
      [placed('m3', 'a', { locked: true })],
      entries,
    );
    expect(explicit.locked).toBe(true);
  });

  it('자산 id 로 맞춘다 — 놓인 버전과 경로가 팔레트의 현재 버전과 달라도 같은 자산이다', () => {
    const current = [
      entry('a', {
        item: {
          id: 'a',
          version: 2,
          label: 'A',
          path: '/asset-library/files/a/v2/a.glb',
          role: 'ground',
        },
      }),
    ];
    const old = placed('m', 'a'); // v1, /maps/a.glb
    expect(getMapPaletteTiles([old], current)[0].placed).toBe(old);
  });

  it('참조가 있으면 경로가 같아도 다른 자산의 타일에 붙지 않는다', () => {
    const other: SavedMapInfo = {
      id: 'm',
      path: '/maps/a.glb',
      asset: { id: 'someone-else', version: 1 },
    };
    expect(getMapPaletteTiles([other], entries)[0].placed).toBeNull();
  });

  it('참조가 없는 지도(옛 저장본)는 경로로 맞춘다', () => {
    const legacy: SavedMapInfo = { id: 'm', path: '/maps/b.glb' };
    const [a, b] = getMapPaletteTiles([legacy], entries);
    expect(a.placed).toBeNull();
    expect(b.placed).toBe(legacy);
  });

  it('경로가 빈 팔레트 항목(브라우저에만 있는 파일)은 경로가 빈 지도와 맞지 않는다', () => {
    const local = entry('local', {
      item: { id: 'local', version: 1, label: 'L', path: '', role: 'ground' },
      blocked: 'local-file',
    });
    const broken: SavedMapInfo = { id: 'm', path: '' };
    expect(getMapPaletteTiles([broken], [local])[0].placed).toBeNull();
  });

  it('같은 자산이 여러 장이면 첫 항목이 대표', () => {
    const first = placed('f', 'a', { locked: false });
    const second = placed('s', 'a');
    const [a] = getMapPaletteTiles([first, second], entries);
    expect(a.placed).toBe(first);
    expect(a.locked).toBe(false);
  });

  it('라이브러리에 없는 지도는 타일을 만들지 않는다', () => {
    const tiles = getMapPaletteTiles(
      [{ id: 'x', path: '/maps/unknown.glb' }, placed('y', 'gone')],
      entries,
    );
    expect(tiles).toHaveLength(2);
    expect(tiles.every((t) => t.placed === null)).toBe(true);
  });

  it('입력을 고치지 않는다', () => {
    const maps = [placed('m', 'a')];
    const snapshot = JSON.stringify(maps);
    getMapPaletteTiles(maps, entries);
    expect(JSON.stringify(maps)).toBe(snapshot);
  });
});
