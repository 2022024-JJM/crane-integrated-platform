import { ASSET_KINDS, type AssetKind, type AssetRecord } from '../model/types';
import type { AssetQuery } from './asset-library-query';

/**
 * 탐색 계층 — 종류 › 태그. 종류(모델·지도·배경·도면·CAD)가 자산이 "어디에
 * 있는가" 이고, 그 아래의 태그는 그 종류 안에서 좁혀 가는 체크박스다.
 * 계층은 저장된 구조가 아니라 자산의 속성(종류·태그)에서 그때그때 만든다 —
 * 태그를 고치면 자산이 옮겨 간다.
 *
 * 태그는 여러 개를 고르면 **모두 가진** 자산만 남는다(`queryAssets` 와 같은
 * 규칙). 그래서 태그의 개수는 고정값이 아니라 "지금 고른 것에 이 태그까지
 * 걸면 몇 개가 남는가" 다 — 0 이면 더 고를 수 없는 태그다.
 */

export interface AssetTreeTagNode {
  /** 표기는 먼저 나온 철자를 쓴다(대소문자만 다른 태그는 하나로 묶는다). */
  tag: string;
  /**
   * 이 태그까지 걸었을 때 남는 자산 수. 이미 고른 태그면 지금 고른 것 전체의
   * 수와 같다.
   */
  count: number;
  checked: boolean;
}

export interface AssetTreeKindNode {
  kind: AssetKind;
  /** 이 종류의 자산 수 — 태그를 걸기 전의 수다. */
  count: number;
  /**
   * 이 종류의 자산이 가진 태그. 많이 쓰인 순(같으면 이름순)이고, 순서는 고른
   * 태그와 무관하다 — 체크해도 줄이 자리를 바꾸지 않는다.
   */
  tags: AssetTreeTagNode[];
}

export interface AssetTree {
  total: number;
  /** 종류는 자산이 없어도 전부 나온다 — 어디에 무엇을 둘 수 있는지 보인다. */
  kinds: AssetTreeKindNode[];
}

/** 계층에 반영할 탐색 상태 — 어느 종류에서 어떤 태그를 골랐는가. */
export interface AssetTreeSelection {
  /** 보고 있는 종류. null 이면 전체 — 고른 태그가 모든 종류에 걸린다. */
  kind: AssetKind | null;
  tags: readonly string[];
}

const NO_SELECTION: AssetTreeSelection = { kind: null, tags: [] };

export function buildAssetTree(
  assets: readonly AssetRecord[],
  selection: AssetTreeSelection = NO_SELECTION,
): AssetTree {
  const selected = [...new Set(selection.tags.map((tag) => tag.toLowerCase()))];
  return {
    total: assets.length,
    kinds: ASSET_KINDS.map((kind) => {
      const ofKind = assets.filter((asset) => asset.kind === kind);
      // 다른 종류를 보고 있으면 이 종류에는 고른 태그가 걸리지 않는다 —
      // 그 종류의 태그를 누르면 그 태그 하나로 새로 시작하기 때문이다.
      const applied =
        selection.kind === null || selection.kind === kind ? selected : [];

      const usage = new Map<string, { tag: string; total: number }>();
      const tagKeys = ofKind.map((asset) => {
        const keys = new Set<string>();
        for (const tag of asset.tags) {
          const key = tag.toLowerCase();
          // 한 자산이 같은 태그를 두 번 가져도 한 번만 센다.
          if (keys.has(key)) continue;
          keys.add(key);
          const entry = usage.get(key);
          if (entry) entry.total += 1;
          else usage.set(key, { tag, total: 1 });
        }
        return keys;
      });

      const matching = tagKeys.filter((keys) =>
        applied.every((key) => keys.has(key)),
      );

      return {
        kind,
        count: ofKind.length,
        tags: [...usage.entries()]
          .sort(
            ([, a], [, b]) =>
              b.total - a.total ||
              a.tag.localeCompare(b.tag, undefined, { numeric: true }),
          )
          .map(([key, { tag }]) => ({
            tag,
            count: matching.filter((keys) => keys.has(key)).length,
            checked: applied.includes(key),
          })),
      };
    }),
  };
}

/**
 * 그 종류의 자산이 이미 쓰는 태그(많이 쓰인 순). 태그를 붙일 때 권한다 —
 * 철자가 갈리면 계층의 체크박스가 둘로 나뉜다.
 */
export function listAssetKindTags(
  assets: readonly AssetRecord[],
  kind: AssetKind,
): string[] {
  return (
    buildAssetTree(assets)
      .kinds.find((node) => node.kind === kind)
      ?.tags.map((node) => node.tag) ?? []
  );
}

/** 계층 위의 한 위치 — 종류. null 이면 라이브러리 전체다. */
export interface AssetScope {
  kind: AssetKind | null;
}

/**
 * 그 위치에 놓인 자산 수 — 태그·필터를 걸기 전의 수다.
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
 * 계층의 위치로 옮긴다. 태그는 푼다 — 태그는 종류 안에서 고르는 것이라
 * 위치를 옮기면 그 위치 전부를 본다. 검색어·상태 등 다른 필터는 그대로 둔다.
 */
export function withAssetScope(
  query: AssetQuery,
  scope: AssetScope,
): AssetQuery {
  return {
    ...query,
    kinds: scope.kind !== null ? [scope.kind] : [],
    tags: [],
  };
}

/**
 * 종류 아래의 태그 체크박스를 누른다.
 *
 * 그 종류를 보고 있거나 전체를 보고 있으면 고른 태그에 더하거나 뺀다. 다른
 * 종류를 보고 있었으면 그 종류로 옮겨 가며 이 태그 하나로 새로 시작한다 —
 * 앞 종류에서 고른 태그는 계층에 보이지 않는 조건이 되기 때문이다.
 * 어느 쪽이든 위치는 그 종류가 된다.
 */
export function toggleAssetScopeTag(
  query: AssetQuery,
  kind: AssetKind,
  tag: string,
): AssetQuery {
  const scope = getAssetScope(query);
  const key = tag.toLowerCase();
  const carried = scope.kind === null || scope.kind === kind ? query.tags : [];
  const has = carried.some((item) => item.toLowerCase() === key);
  return {
    ...query,
    kinds: [kind],
    tags: has
      ? carried.filter((item) => item.toLowerCase() !== key)
      : [...carried, tag],
  };
}
