import {
  getAssetScope,
  type AssetAttentionKind,
  type AssetCollection,
  type AssetKind,
  type AssetQuery,
  type AssetVersionStatus,
} from '@crane/domain/asset-library';

/**
 * 걸려 있는 필터 하나. 목록 위에 칩으로 늘어놓고 하나씩 풀 수 있게 한다 —
 * "왜 이것만 보이는지" 가 보인다.
 *
 * 계층의 위치(조선소 › 종류 › 분류)는 탐색의 범위라 칩이 아니라 경로 표기가
 * 맡는다. 다만 계층으로 나타낼 수 없는 상태(종류를 여럿 고름, 종류 없이
 * 분류만 고름 — 손으로 고친 링크)는 보이지 않는 필터가 되지 않게 칩으로 낸다.
 */
export type ActiveFilter =
  | { type: 'text'; value: string }
  | { type: 'attention'; value: AssetAttentionKind }
  | { type: 'kind'; value: AssetKind }
  | { type: 'category'; value: string }
  | { type: 'status'; value: AssetVersionStatus }
  | { type: 'tag'; value: string }
  | { type: 'collection'; value: string; name: string }
  | { type: 'favorites' };

export function listActiveFilters(
  query: AssetQuery,
  collections: readonly AssetCollection[],
): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  const text = query.text.trim();
  if (text) filters.push({ type: 'text', value: text });
  if (query.attention) {
    filters.push({ type: 'attention', value: query.attention });
  }
  const scope = getAssetScope(query);
  if (scope.kind === null) {
    for (const kind of query.kinds) filters.push({ type: 'kind', value: kind });
    if (query.category !== null) {
      filters.push({ type: 'category', value: query.category });
    }
  }
  for (const status of query.statuses) {
    filters.push({ type: 'status', value: status });
  }
  for (const tag of query.tags) filters.push({ type: 'tag', value: tag });
  if (query.collectionId) {
    const collection = collections.find(
      (item) => item.id === query.collectionId,
    );
    // 지워진 컬렉션을 가리키는 링크도 풀 수는 있어야 한다.
    filters.push({
      type: 'collection',
      value: query.collectionId,
      name: collection?.name ?? query.collectionId,
    });
  }
  if (query.favoritesOnly) filters.push({ type: 'favorites' });
  return filters;
}

export function removeActiveFilter(
  query: AssetQuery,
  filter: ActiveFilter,
): AssetQuery {
  switch (filter.type) {
    case 'text':
      return { ...query, text: '' };
    case 'attention':
      return { ...query, attention: null };
    case 'kind':
      return {
        ...query,
        kinds: query.kinds.filter((kind) => kind !== filter.value),
      };
    case 'category':
      return { ...query, category: null };
    case 'status':
      return {
        ...query,
        statuses: query.statuses.filter((status) => status !== filter.value),
      };
    case 'tag':
      return { ...query, tags: query.tags.filter((tag) => tag !== filter.value) };
    case 'collection':
      return { ...query, collectionId: null };
    case 'favorites':
      return { ...query, favoritesOnly: false };
  }
}

/** 칩의 React key. */
export function activeFilterKey(filter: ActiveFilter): string {
  return filter.type === 'favorites'
    ? 'favorites'
    : `${filter.type}:${filter.value}`;
}
