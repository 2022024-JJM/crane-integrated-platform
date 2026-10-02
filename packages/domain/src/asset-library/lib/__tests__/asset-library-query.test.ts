import { afterEach, describe, expect, it } from 'vitest';
import { registerAssetHashManifest } from '@crane/core/lib/asset-url';
import type { AssetStatsTable } from '../../model/types';
import {
  countAssetFacets,
  DEFAULT_ASSET_QUERY,
  findAssetsByContentHash,
  queryAssets,
  resolveVersionSizeBytes,
  resolveVersionStats,
  type AssetQuery,
  type AssetQueryContext,
} from '../asset-library-query';
import { asset, version } from './fixtures';

const stats = (triangles: number) => ({
  triangles,
  vertices: 0,
  meshes: 0,
  materials: 0,
  textures: 0,
  drawCalls: 0,
  nodes: 0,
  textureMemoryBytes: 0,
  size: null,
  lodLevels: 1,
  animations: 0,
});

const file = (path: string, extra = {}) => ({
  ref: { storage: 'public' as const, path },
  fileName: path.split('/').pop() ?? '',
  format: 'glb',
  sizeBytes: null,
  contentHash: null,
  ...extra,
});

const okpoCrane = asset({
  id: 'okpo-crane',
  name: 'Okpo Crane 10',
  tags: ['crane', 'outdoor'],
  updatedAt: '2026-03-01T00:00:00.000Z',
  versions: [version({ file: file('/models/okpo.glb') })],
});
const phillyMap = asset({
  id: 'philly-map',
  kind: 'map',
  name: 'Philly Area',
  tags: ['ground'],
  updatedAt: '2026-01-01T00:00:00.000Z',
  versions: [version({ status: 'draft', file: file('/maps/philly.glb') })],
});
const shared = asset({
  id: 'shared-worker',
  name: 'Okpo Crane 2',
  tags: ['Crane'],
  description: 'collision guard worker',
  updatedAt: '',
  versions: [version({ file: file('/models/man.glb') })],
});
const assets = [okpoCrane, phillyMap, shared];

const table: AssetStatsTable = {
  '/models/okpo.glb': { hash: 'aaaa1111', bytes: 300, stats: stats(50) },
  '/maps/philly.glb': { hash: 'bbbb2222', bytes: 900, stats: stats(700) },
};
const context: AssetQueryContext = {
  collections: [{ id: 'yard', name: 'Yard', assetIds: ['philly-map'] }],
  favorites: new Set(['shared-worker']),
  statsTable: table,
};
const q = (patch: Partial<AssetQuery>): AssetQuery => ({
  ...DEFAULT_ASSET_QUERY,
  ...patch,
});
const ids = (query: Partial<AssetQuery>) =>
  queryAssets(assets, q(query), context).map((a) => a.id);

afterEach(() => registerAssetHashManifest({}));

describe('queryAssets', () => {
  it('기본 쿼리는 전부를 이름순(숫자 인식)으로 돌려준다', () => {
    // "Crane 2" 가 "Crane 10" 보다 앞.
    expect(ids({})).toEqual(['shared-worker', 'okpo-crane', 'philly-map']);
  });

  it('입력 배열을 바꾸지 않는다', () => {
    const before = [...assets];
    queryAssets(assets, q({ sort: 'size' }), context);
    expect(assets).toEqual(before);
  });

  it('검색은 이름·id·설명·태그·파일명을 대소문자 무시로 본다', () => {
    expect(ids({ text: 'PHILLY' })).toEqual(['philly-map']);
    expect(ids({ text: 'collision' })).toEqual(['shared-worker']);
    expect(ids({ text: 'man.glb' })).toEqual(['shared-worker']);
    expect(ids({ text: 'ground' })).toEqual(['philly-map']);
    expect(ids({ text: '   ' })).toHaveLength(3);
    expect(ids({ text: 'nothing-matches' })).toEqual([]);
  });

  it('종류·상태 필터는 현재 버전 기준이다', () => {
    expect(ids({ kinds: ['map'] })).toEqual(['philly-map']);
    expect(ids({ statuses: ['draft'] })).toEqual(['philly-map']);
    expect(ids({ kinds: ['drawing'] })).toEqual([]);
  });

  it('태그는 고른 것을 모두 가진 자산만(대소문자 무시)', () => {
    expect(ids({ tags: ['crane'] })).toEqual(['shared-worker', 'okpo-crane']);
    expect(ids({ tags: ['crane', 'outdoor'] })).toEqual(['okpo-crane']);
    // 가진 자산이 없는 태그가 하나라도 끼면 아무것도 남지 않는다.
    expect(ids({ tags: ['crane', 'nope'] })).toEqual([]);
    // 종류와 함께 걸면 그 종류 안에서 좁힌다.
    expect(ids({ kinds: ['map'], tags: ['crane'] })).toEqual([]);
    expect(ids({ kinds: ['map'], tags: ['ground'] })).toEqual(['philly-map']);
  });

  it('컬렉션·즐겨찾기 필터', () => {
    expect(ids({ collectionId: 'yard' })).toEqual(['philly-map']);
    expect(ids({ favoritesOnly: true })).toEqual(['shared-worker']);
    // 없는 컬렉션은 아무것도 속하지 않는다.
    expect(ids({ collectionId: 'missing' })).toEqual([]);
  });

  it('최근 수정순 — 시각을 모르는 것은 뒤', () => {
    expect(ids({ sort: 'updated' })).toEqual([
      'okpo-crane',
      'philly-map',
      'shared-worker',
    ]);
  });

  it('크기·삼각형순 — 값이 없는 것은 뒤', () => {
    expect(ids({ sort: 'size' })).toEqual([
      'philly-map',
      'okpo-crane',
      'shared-worker',
    ]);
    expect(ids({ sort: 'triangles' })).toEqual([
      'philly-map',
      'okpo-crane',
      'shared-worker',
    ]);
  });

  it('빈 목록은 빈 목록', () => {
    expect(queryAssets([], q({}), context)).toEqual([]);
  });
});

describe('resolveVersionSizeBytes / resolveVersionStats', () => {
  const current = okpoCrane.versions[0];

  it('레코드의 값이 표보다 우선한다', () => {
    const own = version({
      file: file('/models/okpo.glb', { sizeBytes: 7 }),
      stats: stats(1),
    });
    expect(resolveVersionSizeBytes(own, table)).toBe(7);
    expect(resolveVersionStats(own, table)?.triangles).toBe(1);
  });

  it('레코드에 없으면 표에서 찾고, 표에도 없으면 null', () => {
    expect(resolveVersionSizeBytes(current, table)).toBe(300);
    expect(resolveVersionStats(current, table)?.triangles).toBe(50);
    expect(resolveVersionSizeBytes(shared.versions[0], table)).toBeNull();
    expect(resolveVersionStats(shared.versions[0], table)).toBeNull();
  });

  it('브라우저 저장 파일은 표를 보지 않는다', () => {
    const local = version({
      file: {
        ...file('/x'),
        ref: { storage: 'browser', key: '/models/okpo.glb' },
      },
    });
    expect(resolveVersionSizeBytes(local, table)).toBeNull();
  });

  it('배포 파일의 해시가 표와 다르면(표가 낡았으면) 쓰지 않는다', () => {
    registerAssetHashManifest({ '/models/okpo.glb': 'ffff9999' });
    expect(resolveVersionSizeBytes(current, table)).toBeNull();
    expect(resolveVersionStats(current, table)).toBeNull();
    registerAssetHashManifest({ '/models/okpo.glb': 'aaaa1111' });
    expect(resolveVersionStats(current, table)?.triangles).toBe(50);
  });
});

describe('countAssetFacets', () => {
  it('종류·상태별 개수를 센다', () => {
    const facets = countAssetFacets(assets);
    expect(facets.total).toBe(3);
    expect(facets.kinds).toEqual({
      model: 2,
      map: 1,
      environment: 0,
      drawing: 0,
      cad: 0,
    });
    expect(facets.statuses.published).toBe(2);
    expect(facets.statuses.draft).toBe(1);
  });

  it('태그는 대소문자를 묶어 세고, 많이 쓰인 순·같으면 이름순으로 낸다', () => {
    expect(countAssetFacets(assets).tags).toEqual([
      // 'crane' 과 'Crane' 은 한 태그 — 표기는 먼저 나온 것.
      { tag: 'crane', count: 2 },
      { tag: 'ground', count: 1 },
      { tag: 'outdoor', count: 1 },
    ]);
  });

  it('빈 목록도 모든 키를 0 으로 채운다', () => {
    const facets = countAssetFacets([]);
    expect(facets.total).toBe(0);
    expect(Object.values(facets.kinds).every((count) => count === 0)).toBe(true);
    expect(Object.values(facets.statuses).every((count) => count === 0)).toBe(
      true,
    );
    expect(facets.tags).toEqual([]);
  });
});

describe('findAssetsByContentHash', () => {
  const hashed = asset({
    id: 'uploaded',
    versions: [
      version({ file: file('/a.glb', { contentHash: 'sha256:aaaa1111ffff' }) }),
      version({
        version: 2,
        file: file('/b.glb', { contentHash: 'sha256:other' }),
      }),
    ],
  });

  it('해시가 기록된 버전은 해시가 같을 때만 찾는다', () => {
    expect(
      findAssetsByContentHash([hashed], 'sha256:aaaa1111ffff'),
    ).toEqual([{ asset: hashed, version: 1 }]);
    expect(findAssetsByContentHash([hashed], 'sha256:nope')).toEqual([]);
    expect(findAssetsByContentHash([hashed], '')).toEqual([]);
  });

  it('배포 파일은 표의 해시 앞자리와 바이트 크기가 모두 같아야 찾는다', () => {
    const deployed = { sizeBytes: 300, statsTable: table };
    expect(
      findAssetsByContentHash([okpoCrane], 'sha256:aaaa1111ffff', deployed),
    ).toEqual([{ asset: okpoCrane, version: 1 }]);
    // 크기가 1바이트 다르면 다른 파일.
    expect(
      findAssetsByContentHash([okpoCrane], 'sha256:aaaa1111ffff', {
        ...deployed,
        sizeBytes: 301,
      }),
    ).toEqual([]);
    // 표를 주지 않으면 배포 파일과는 비교하지 않는다.
    expect(findAssetsByContentHash([okpoCrane], 'sha256:aaaa1111ffff')).toEqual([]);
  });

  it('SHA-256 이 아닌 해시로는 배포 파일과 비교하지 않는다', () => {
    expect(
      findAssetsByContentHash([okpoCrane], 'fnv:aaaa1111ffff', {
        sizeBytes: 300,
        statsTable: table,
      }),
    ).toEqual([]);
  });
});

describe('queryAssets — 정렬 방향', () => {
  const sized = (id: string, name: string, sizeBytes: number | null, updatedAt: string) =>
    asset({
      id,
      name,
      updatedAt,
      versions: [
        version({
          file: {
            ref: { storage: 'public', path: `/models/${id}.glb` },
            fileName: `${id}.glb`,
            format: 'glb',
            sizeBytes,
            contentHash: null,
          },
        }),
      ],
    });
  const list = [
    sized('a', 'Alpha', 300, '2026-03-01T00:00:00.000Z'),
    sized('b', 'Bravo', null, ''),
    sized('c', 'Charlie', 100, '2026-01-01T00:00:00.000Z'),
    sized('d', 'Delta', 200, '2026-02-01T00:00:00.000Z'),
  ];
  const context = { collections: [], favorites: new Set<string>(), statsTable: {} };
  const ids = (sort: 'name' | 'size' | 'updated', reverse: boolean) =>
    queryAssets(list, { ...DEFAULT_ASSET_QUERY, sort, reverse }, context).map(
      (item) => item.id,
    );

  it('이름은 뒤집으면 역순', () => {
    expect(ids('name', false)).toEqual(['a', 'b', 'c', 'd']);
    expect(ids('name', true)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('크기는 큰 것이 앞, 뒤집으면 작은 것이 앞 — 모르는 값은 늘 맨 뒤', () => {
    expect(ids('size', false)).toEqual(['a', 'd', 'c', 'b']);
    expect(ids('size', true)).toEqual(['c', 'd', 'a', 'b']);
  });

  it('수정일은 최근이 앞, 뒤집으면 오래된 것이 앞 — 모르는 시각은 늘 맨 뒤', () => {
    expect(ids('updated', false)).toEqual(['a', 'd', 'c', 'b']);
    expect(ids('updated', true)).toEqual(['c', 'd', 'a', 'b']);
  });
});
