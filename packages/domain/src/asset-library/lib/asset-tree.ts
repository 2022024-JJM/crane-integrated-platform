import { ASSET_KINDS, type AssetKind, type AssetRecord } from '../model/types';
import type { AssetQuery } from './asset-library-query';

/**
 * 탐색 계층 — 종류 › 카테고리. 종류(모델·지도·배경·도면·CAD)가 자산이 "어디에
 * 있는가" 이고, 그 아래의 카테고리는 그 종류 안에서 좁혀 가는 체크박스다.
 * 계층은 저장된 구조가 아니라 자산의 속성(종류·카테고리)에서 그때그때 만든다 —
 * 카테고리를 고치면 자산이 옮겨 간다.
 *
 * 카테고리는 여러 개를 고르면 **모두 가진** 자산만 남는다(`queryAssets` 와 같은
 * 규칙). 그래서 카테고리의 개수는 고정값이 아니라 "지금 고른 것에 이 카테고리까지
 * 걸면 몇 개가 남는가" 다 — 0 이면 더 고를 수 없는 카테고리다.
 */

export interface AssetTreeCategoryNode {
  /** 표기는 먼저 나온 철자를 쓴다(대소문자만 다른 카테고리는 하나로 묶는다). */
  category: string;
  /**
   * 이 카테고리까지 걸었을 때 남는 자산 수. 이미 고른 카테고리면 지금 고른 것 전체의
   * 수와 같다.
   */
  count: number;
  checked: boolean;
}

export interface AssetTreeKindNode {
  kind: AssetKind;
  /** 이 종류의 자산 수 — 카테고리를 걸기 전의 수다. */
  count: number;
  /**
   * 이 종류의 자산이 가진 카테고리. 많이 쓰인 순(같으면 이름순)이고, 순서는 고른
   * 카테고리와 무관하다 — 체크해도 줄이 자리를 바꾸지 않는다.
   */
  categories: AssetTreeCategoryNode[];
}

export interface AssetTree {
  total: number;
  /** 종류는 자산이 없어도 전부 나온다 — 어디에 무엇을 둘 수 있는지 보인다. */
  kinds: AssetTreeKindNode[];
}

/** 계층에 반영할 탐색 상태 — 어느 종류에서 어떤 카테고리를 골랐는가. */
export interface AssetTreeSelection {
  /** 보고 있는 종류. null 이면 전체 — 고른 카테고리가 모든 종류에 걸린다. */
  kind: AssetKind | null;
  categories: readonly string[];
}

const NO_SELECTION: AssetTreeSelection = { kind: null, categories: [] };

/**
 * 카테고리 목록들(자산마다 하나)에서 고를 수 있는 카테고리 줄을 만든다. 계층의 종류
 * 아래 카테고리와 3D 화면 편집 팔레트의 카테고리 고르기가 이 규칙 하나를 쓴다.
 *
 * - 대소문자만 다른 카테고리는 한 줄이고 표기는 먼저 나온 철자다.
 * - 순서는 많이 쓰인 순(같으면 이름순)이고 고른 카테고리와 무관하다.
 * - 수는 "고른 것에 이 카테고리까지 걸면 남는 수" 다. 고른 카테고리가 목록에 없는
 *   것이면 줄은 생기지 않고 전부 0 이 된다.
 */
export function buildAssetCategoryNodes(
  categoryLists: readonly (readonly string[])[],
  selected: readonly string[] = [],
): AssetTreeCategoryNode[] {
  const applied = [...new Set(selected.map((category) => category.toLowerCase()))];
  const usage = new Map<string, { category: string; total: number }>();
  const categoryKeys = categoryLists.map((categories) => {
    const keys = new Set<string>();
    for (const category of categories) {
      const key = category.toLowerCase();
      // 한 자산이 같은 카테고리를 두 번 가져도 한 번만 센다.
      if (keys.has(key)) continue;
      keys.add(key);
      const entry = usage.get(key);
      if (entry) entry.total += 1;
      else usage.set(key, { category, total: 1 });
    }
    return keys;
  });

  const matching = categoryKeys.filter((keys) =>
    applied.every((key) => keys.has(key)),
  );

  return [...usage.entries()]
    .sort(
      ([, a], [, b]) =>
        b.total - a.total ||
        a.category.localeCompare(b.category, undefined, { numeric: true }),
    )
    .map(([key, { category }]) => ({
      category,
      count: matching.filter((keys) => keys.has(key)).length,
      checked: applied.includes(key),
    }));
}

/**
 * 고른 카테고리를 **모두** 가졌는가(대소문자 무시). 고른 것이 없으면 참이다 —
 * `queryAssets` 와 `buildAssetCategoryNodes` 의 수가 따르는 규칙과 같다.
 */
export function hasAllAssetCategories(
  categories: readonly string[],
  selected: readonly string[],
): boolean {
  if (selected.length === 0) return true;
  const own = new Set(categories.map((category) => category.toLowerCase()));
  return selected.every((category) => own.has(category.toLowerCase()));
}

export function buildAssetTree(
  assets: readonly AssetRecord[],
  selection: AssetTreeSelection = NO_SELECTION,
): AssetTree {
  return {
    total: assets.length,
    kinds: ASSET_KINDS.map((kind) => {
      const ofKind = assets.filter((asset) => asset.kind === kind);
      // 다른 종류를 보고 있으면 이 종류에는 고른 카테고리가 걸리지 않는다 —
      // 그 종류의 카테고리를 누르면 그 카테고리 하나로 새로 시작하기 때문이다.
      const applied =
        selection.kind === null || selection.kind === kind
          ? selection.categories
          : [];

      return {
        kind,
        count: ofKind.length,
        categories: buildAssetCategoryNodes(
          ofKind.map((asset) => asset.categories),
          applied,
        ),
      };
    }),
  };
}

/**
 * 그 종류의 자산이 이미 쓰는 카테고리(많이 쓰인 순). 카테고리를 붙일 때 권한다 —
 * 철자가 갈리면 계층의 체크박스가 둘로 나뉜다.
 */
export function listAssetKindCategories(
  assets: readonly AssetRecord[],
  kind: AssetKind,
): string[] {
  return (
    buildAssetTree(assets)
      .kinds.find((node) => node.kind === kind)
      ?.categories.map((node) => node.category) ?? []
  );
}

/** 계층 위의 한 위치 — 종류. null 이면 라이브러리 전체다. */
export interface AssetScope {
  kind: AssetKind | null;
}

/**
 * 그 위치에 놓인 자산 수 — 카테고리·필터를 걸기 전의 수다.
 */
export function countAssetScope(tree: AssetTree, scope: AssetScope): number {
  if (scope.kind === null) return tree.total;
  return tree.kinds.find((node) => node.kind === scope.kind)?.count ?? 0;
}

/** 탐색 상태가 가리키는 위치. 종류를 여럿 고른 상태는 종류 마디가 아니다. */
export function getAssetScope(query: AssetQuery): AssetScope {
  return { kind: query.kinds.length === 1 ? query.kinds[0] : null };
}

/**
 * 계층의 위치로 옮긴다. 카테고리는 푼다 — 카테고리는 종류 안에서 고르는 것이라
 * 위치를 옮기면 그 위치 전부를 본다. 검색어·상태 등 다른 필터는 그대로 둔다.
 */
export function withAssetScope(
  query: AssetQuery,
  scope: AssetScope,
): AssetQuery {
  return {
    ...query,
    kinds: scope.kind !== null ? [scope.kind] : [],
    categories: [],
  };
}

/**
 * 종류 아래의 카테고리 체크박스를 누른다.
 *
 * 그 종류를 보고 있거나 전체를 보고 있으면 고른 카테고리에 더하거나 뺀다. 다른
 * 종류를 보고 있었으면 그 종류로 옮겨 가며 이 카테고리 하나로 새로 시작한다 —
 * 앞 종류에서 고른 카테고리는 계층에 보이지 않는 조건이 되기 때문이다.
 * 어느 쪽이든 위치는 그 종류가 된다.
 */
export function toggleAssetScopeCategory(
  query: AssetQuery,
  kind: AssetKind,
  category: string,
): AssetQuery {
  const scope = getAssetScope(query);
  const key = category.toLowerCase();
  const carried = scope.kind === null || scope.kind === kind ? query.categories : [];
  const has = carried.some((item) => item.toLowerCase() === key);
  return {
    ...query,
    kinds: [kind],
    categories: has
      ? carried.filter((item) => item.toLowerCase() !== key)
      : [...carried, category],
  };
}
