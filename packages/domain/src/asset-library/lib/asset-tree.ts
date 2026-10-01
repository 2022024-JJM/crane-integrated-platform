import {
  ASSET_KINDS,
  ASSET_SITES,
  type AssetKind,
  type AssetRecord,
} from '../model/types';
import {
  matchesSiteFilter,
  type AssetQuery,
  type AssetSiteFilter,
} from './asset-library-query';

/**
 * 탐색 계층 — 조선소 › 종류 › 분류. 자산이 "어디에 있는가" 를 폴더처럼
 * 내려가며 찾는다. 계층은 저장된 구조가 아니라 자산의 속성(조선소·종류·
 * 분류)에서 그때그때 만든다 — 속성을 고치면 자산이 옮겨 간다.
 *
 * 조선소 마디는 그 조선소 자산과 공용 자산을 함께 센다(`matchesSiteFilter`
 * 와 같은 규칙) — 공용 자산은 모든 조선소가 쓴다.
 */

/** 계층의 최상위 마디 순서. */
export const ASSET_TREE_SITES: readonly AssetSiteFilter[] = [
  'all',
  ...ASSET_SITES,
  'common',
];

export interface AssetTreeCategoryNode {
  category: string;
  count: number;
}

export interface AssetTreeKindNode {
  kind: AssetKind;
  count: number;
  /** 이름순. 분류가 비어 있는 자산은 종류 마디에만 속한다. */
  categories: AssetTreeCategoryNode[];
}

export interface AssetTreeSiteNode {
  site: AssetSiteFilter;
  count: number;
  /** 종류는 자산이 없어도 전부 나온다 — 어디에 무엇을 둘 수 있는지 보인다. */
  kinds: AssetTreeKindNode[];
}

export function buildAssetTree(
  assets: readonly AssetRecord[],
): AssetTreeSiteNode[] {
  return ASSET_TREE_SITES.map((site) => {
    const inSite = assets.filter((asset) => matchesSiteFilter(asset, site));
    return {
      site,
      count: inSite.length,
      kinds: ASSET_KINDS.map((kind) => {
        const ofKind = inSite.filter((asset) => asset.kind === kind);
        const counts = new Map<string, number>();
        for (const asset of ofKind) {
          if (!asset.category) continue;
          counts.set(asset.category, (counts.get(asset.category) ?? 0) + 1);
        }
        return {
          kind,
          count: ofKind.length,
          categories: [...counts.entries()]
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) =>
              a.category.localeCompare(b.category, undefined, { numeric: true }),
            ),
        };
      }),
    };
  });
}

/**
 * 그 위치에 놓인 자산 수 — 필터를 걸기 전의 수다. 계층에 없는 위치(없는
 * 분류 등)는 0.
 */
export function countAssetScope(
  tree: readonly AssetTreeSiteNode[],
  scope: AssetScope,
): number {
  const site = tree.find((node) => node.site === scope.site);
  if (!site) return 0;
  if (scope.kind === null) return site.count;
  const kind = site.kinds.find((node) => node.kind === scope.kind);
  if (!kind) return 0;
  if (scope.category === null) return kind.count;
  return (
    kind.categories.find((node) => node.category === scope.category)?.count ??
    0
  );
}

/** 계층 위의 한 위치. 깊은 값은 얕은 값이 있을 때만 뜻이 있다. */
export interface AssetScope {
  site: AssetSiteFilter;
  kind: AssetKind | null;
  category: string | null;
}

/** 탐색 상태가 가리키는 위치. 종류를 여럿 고른 상태는 종류 마디가 아니다. */
export function getAssetScope(query: AssetQuery): AssetScope {
  const kind = query.kinds.length === 1 ? query.kinds[0] : null;
  return {
    site: query.site,
    kind,
    category: kind !== null ? query.category : null,
  };
}

/** 계층의 위치로 옮긴다. 검색어·상태 등 다른 필터는 그대로 둔다. */
export function withAssetScope(
  query: AssetQuery,
  scope: AssetScope,
): AssetQuery {
  return {
    ...query,
    site: scope.site,
    kinds: scope.kind !== null ? [scope.kind] : [],
    category: scope.kind !== null ? scope.category : null,
  };
}

/**
 * 자산이 계층에서 놓이는 대표 조선소. 조선소를 여럿 가진 자산은 표의 앞쪽
 * 조선소를 쓴다(경로 표기는 하나여야 한다).
 */
export function getPrimaryAssetSite(asset: AssetRecord): AssetSiteFilter {
  return ASSET_SITES.find((site) => asset.sites.includes(site)) ?? 'common';
}
