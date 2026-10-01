import { describe, expect, it } from 'vitest';
import { ASSET_KINDS } from '../../model/types';
import { DEFAULT_ASSET_QUERY, queryAssets } from '../asset-library-query';
import {
  ASSET_TREE_SITES,
  buildAssetTree,
  countAssetScope,
  getAssetScope,
  getPrimaryAssetSite,
  withAssetScope,
} from '../asset-tree';
import { asset } from './fixtures';

const assets = [
  asset({ id: 'a', kind: 'model', sites: ['okpo'], category: 'indoor' }),
  asset({ id: 'b', kind: 'model', sites: ['okpo'], category: 'crane 10' }),
  asset({ id: 'c', kind: 'model', sites: ['okpo'], category: 'crane 2' }),
  asset({ id: 'd', kind: 'model', sites: [], category: 'runtime' }),
  asset({ id: 'e', kind: 'drawing', sites: ['philly'], category: '' }),
  asset({ id: 'f', kind: 'cad', sites: ['okpo', 'philly'], category: 'hull' }),
];

const node = (site: string) =>
  buildAssetTree(assets).find((item) => item.site === site)!;
const kindOf = (site: string, kind: string) =>
  node(site).kinds.find((item) => item.kind === kind)!;

describe('buildAssetTree', () => {
  it('최상위는 전체·조선소·공용 순이고, 종류는 자산이 없어도 전부 나온다', () => {
    const tree = buildAssetTree([]);
    expect(tree.map((item) => item.site)).toEqual([...ASSET_TREE_SITES]);
    for (const site of tree) {
      expect(site.count).toBe(0);
      expect(site.kinds.map((item) => item.kind)).toEqual([...ASSET_KINDS]);
      expect(site.kinds.every((item) => item.categories.length === 0)).toBe(
        true,
      );
    }
  });

  it('조선소 마디는 공용 자산을 함께 센다', () => {
    expect(node('all').count).toBe(6);
    expect(node('okpo').count).toBe(5); // a b c f + 공용 d
    expect(node('philly').count).toBe(3); // e f + 공용 d
    expect(node('common').count).toBe(1);
  });

  it('여러 조선소에 속한 자산은 각 조선소에서 센다', () => {
    expect(kindOf('okpo', 'cad').count).toBe(1);
    expect(kindOf('philly', 'cad').count).toBe(1);
  });

  it('분류는 이름순(숫자는 수로 비교)으로 세고, 빈 분류는 마디가 없다', () => {
    expect(kindOf('okpo', 'model').categories).toEqual([
      { category: 'crane 2', count: 1 },
      { category: 'crane 10', count: 1 },
      { category: 'indoor', count: 1 },
      { category: 'runtime', count: 1 },
    ]);
    const drawings = kindOf('philly', 'drawing');
    expect(drawings.count).toBe(1);
    expect(drawings.categories).toEqual([]);
  });

  it('마디의 개수는 그 위치로 옮긴 탐색 결과의 개수와 같다', () => {
    const context = {
      collections: [],
      favorites: new Set<string>(),
      statsTable: {},
    };
    for (const site of buildAssetTree(assets)) {
      for (const kind of site.kinds) {
        const scoped = (category: string | null) =>
          queryAssets(
            assets,
            withAssetScope(DEFAULT_ASSET_QUERY, {
              site: site.site,
              kind: kind.kind,
              category,
            }),
            context,
          ).length;
        expect(scoped(null)).toBe(kind.count);
        for (const category of kind.categories) {
          expect(scoped(category.category)).toBe(category.count);
        }
      }
    }
  });
});

describe('getAssetScope / withAssetScope', () => {
  it('기본 탐색 상태는 최상위다', () => {
    expect(getAssetScope(DEFAULT_ASSET_QUERY)).toEqual({
      site: 'all',
      kind: null,
      category: null,
    });
  });

  it('위치로 옮겼다 읽으면 같은 위치다', () => {
    const scope = { site: 'okpo', kind: 'model', category: 'indoor' } as const;
    expect(getAssetScope(withAssetScope(DEFAULT_ASSET_QUERY, scope))).toEqual(
      scope,
    );
  });

  it('종류가 없으면 분류를 버린다', () => {
    const query = withAssetScope(DEFAULT_ASSET_QUERY, {
      site: 'okpo',
      kind: null,
      category: 'indoor',
    });
    expect(query.kinds).toEqual([]);
    expect(query.category).toBeNull();
  });

  it('종류를 여럿 고른 상태는 종류 마디가 아니다', () => {
    expect(
      getAssetScope({
        ...DEFAULT_ASSET_QUERY,
        kinds: ['model', 'map'],
        category: 'indoor',
      }),
    ).toEqual({ site: 'all', kind: null, category: null });
  });

  it('다른 필터는 건드리지 않는다', () => {
    const query = {
      ...DEFAULT_ASSET_QUERY,
      text: 'crane',
      statuses: ['draft' as const],
      sort: 'size' as const,
    };
    expect(
      withAssetScope(query, { site: 'philly', kind: 'cad', category: null }),
    ).toMatchObject({ text: 'crane', statuses: ['draft'], sort: 'size' });
  });
});

describe('queryAssets — 분류 필터', () => {
  const context = { collections: [], favorites: new Set<string>(), statsTable: {} };
  it('정확히 같은 분류만 남긴다(대소문자를 가린다)', () => {
    const ids = (category: string) =>
      queryAssets(assets, { ...DEFAULT_ASSET_QUERY, category }, context).map(
        (item) => item.id,
      );
    expect(ids('indoor')).toEqual(['a']);
    expect(ids('Indoor')).toEqual([]);
    expect(ids('crane')).toEqual([]);
  });
});

describe('getPrimaryAssetSite', () => {
  it('조선소가 없으면 공용, 여럿이면 표의 앞쪽', () => {
    expect(getPrimaryAssetSite(asset({ sites: [] }))).toBe('common');
    expect(getPrimaryAssetSite(asset({ sites: ['philly'] }))).toBe('philly');
    expect(getPrimaryAssetSite(asset({ sites: ['philly', 'okpo'] }))).toBe(
      'okpo',
    );
  });
});

describe('countAssetScope', () => {
  const tree = buildAssetTree(assets);
  it('조선소·종류·분류 단마다 그 마디의 수', () => {
    expect(countAssetScope(tree, { site: 'all', kind: null, category: null })).toBe(6);
    expect(countAssetScope(tree, { site: 'okpo', kind: 'model', category: null })).toBe(4);
    expect(
      countAssetScope(tree, { site: 'okpo', kind: 'model', category: 'indoor' }),
    ).toBe(1);
  });

  it('계층에 없는 위치는 0', () => {
    expect(
      countAssetScope(tree, { site: 'okpo', kind: 'model', category: 'nope' }),
    ).toBe(0);
    expect(countAssetScope([], { site: 'all', kind: null, category: null })).toBe(0);
  });
});
