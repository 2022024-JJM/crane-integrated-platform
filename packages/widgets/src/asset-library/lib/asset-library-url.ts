import {
  ASSET_ATTENTION_KINDS,
  ASSET_KINDS,
  ASSET_SORT_KEYS,
  ASSET_VERSION_STATUSES,
  DEFAULT_ASSET_QUERY,
  type AssetAttentionKind,
  type AssetKind,
  type AssetQuery,
  type AssetSortKey,
  type AssetVersionStatus,
} from '@crane/domain/asset-library';

/**
 * 탐색 상태 ↔ URL 쿼리스트링.
 *
 * 필터·검색·정렬은 URL 이 단일 소스다 — 링크로 같은 목록을 공유할 수 있고,
 * 상세 화면에서 뒤로 오면 보던 목록 그대로다. 기본값인 항목은 URL 에 쓰지
 * 않고, 알 수 없는 값은 버리고 기본값으로 읽는다.
 */

const LIST_SEPARATOR = ',';
const RETIRED_PARAMS = ['site', 'cat'];

/** 목록 옆 미리보기에 올린 자산 id. 필터가 아니라 보기 상태다. */
export const PREVIEW_PARAM = 'preview';

function readList<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T[] {
  if (!raw) return [];
  const values = raw.split(LIST_SEPARATOR);
  // 표의 순서로 정규화한다 — 고른 순서가 달라도 같은 URL 이 된다.
  return allowed.filter((item) => values.includes(item));
}

export function parseAssetQuery(params: URLSearchParams): AssetQuery {
  const sort = params.get('sort');
  return {
    text: params.get('q') ?? '',
    kinds: readList<AssetKind>(params.get('kind'), ASSET_KINDS),
    statuses: readList<AssetVersionStatus>(
      params.get('status'),
      ASSET_VERSION_STATUSES,
    ),
    tags: (params.get('tag') ?? '')
      .split(LIST_SEPARATOR)
      .map((tag) => tag.trim())
      .filter(Boolean),
    collectionId: params.get('collection') || null,
    favoritesOnly: params.get('fav') === '1',
    attention: (ASSET_ATTENTION_KINDS as readonly string[]).includes(
      params.get('attn') ?? '',
    )
      ? (params.get('attn') as AssetAttentionKind)
      : null,
    sort: (ASSET_SORT_KEYS as readonly string[]).includes(sort ?? '')
      ? (sort as AssetSortKey)
      : DEFAULT_ASSET_QUERY.sort,
    reverse: params.get('rev') === '1',
  };
}

/**
 * 탐색 상태를 기존 쿼리스트링 위에 쓴다. 이 화면이 모르는 파라미터는
 * 그대로 둔다.
 */
export function writeAssetQuery(
  current: URLSearchParams,
  query: AssetQuery,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const put = (key: string, value: string) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  // 없어진 필터(조선소·분류)의 파라미터 — 옛 링크로 들어온 것이 주소에
  // 뜻 없이 남아 다시 공유되지 않게 지운다.
  for (const key of RETIRED_PARAMS) next.delete(key);
  put('q', query.text.trim());
  put('kind', query.kinds.join(LIST_SEPARATOR));
  put('status', query.statuses.join(LIST_SEPARATOR));
  put('tag', query.tags.join(LIST_SEPARATOR));
  put('collection', query.collectionId ?? '');
  put('fav', query.favoritesOnly ? '1' : '');
  put('attn', query.attention ?? '');
  put('sort', query.sort === DEFAULT_ASSET_QUERY.sort ? '' : query.sort);
  put('rev', query.reverse ? '1' : '');
  return next;
}

export const DETAIL_TABS = [
  'info',
  'stats',
  'versions',
  'usage',
  'activity',
] as const;
export type DetailTab = (typeof DETAIL_TABS)[number];

export function parseDetailTab(raw: string | null): DetailTab {
  return (DETAIL_TABS as readonly string[]).includes(raw ?? '')
    ? (raw as DetailTab)
    : 'info';
}

/** 상세 화면에서 나란히 비교할 기준 버전 번호(`?compare=`). */
export const COMPARE_PARAM = 'compare';

/** `?v=` 의 버전 번호. 정수가 아니거나 1 미만이면 null(현재 버전을 본다). */
export function parseVersionParam(raw: string | null): number | null {
  if (!raw || !/^\d{1,6}$/.test(raw)) return null;
  const version = Number(raw);
  return version >= 1 ? version : null;
}
