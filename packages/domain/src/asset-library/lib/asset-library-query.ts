import { getAssetContentHash } from '@crane/core/lib/asset-url';
import {
  ASSET_KINDS,
  ASSET_VERSION_STATUSES,
  type AssetCollection,
  type AssetKind,
  type AssetRecord,
  type AssetStats,
  type AssetStatsTable,
  type AssetStatsTableEntry,
  type AssetVersion,
  type AssetVersionStatus,
} from '../model/types';
import {
  getAssetAttention,
  type AssetAttentionKind,
} from './asset-attention';
import { hasAllAssetCategories } from './asset-tree';
import { getCurrentAssetVersion } from './asset-versions';

/**
 * 라이브러리 탐색 — 검색·필터·정렬·패싯 집계. 전부 순수 함수이고, 필터
 * 상태(AssetQuery)는 URL 로 직렬화할 수 있는 값만 가진다.
 */

const EMPTY_PLACEMENTS: ReadonlyMap<string, number> = new Map();

export const ASSET_SORT_KEYS = ['name', 'updated', 'size', 'triangles'] as const;
export type AssetSortKey = (typeof ASSET_SORT_KEYS)[number];

export interface AssetQuery {
  text: string;
  kinds: AssetKind[];
  statuses: AssetVersionStatus[];
  /** 고른 카테고리를 **모두** 가진 자산만. 대소문자를 가리지 않는다. */
  categories: string[];
  collectionId: string | null;
  favoritesOnly: boolean;
  /** "처리할 일" 보기 — 그 이유에 해당하는 자산만. */
  attention: AssetAttentionKind | null;
  sort: AssetSortKey;
  /** 정렬 방향을 뒤집는다(이름 역순, 오래된 것·작은 것이 앞). */
  reverse: boolean;
}

export const DEFAULT_ASSET_QUERY: AssetQuery = {
  text: '',
  kinds: [],
  statuses: [],
  categories: [],
  collectionId: null,
  favoritesOnly: false,
  attention: null,
  sort: 'name',
  reverse: false,
};

export interface AssetQueryContext {
  collections: readonly AssetCollection[];
  favorites: ReadonlySet<string>;
  statsTable: AssetStatsTable;
  /** 자산 id → 씬에 놓인 개수. "처리할 일" 판정에 쓴다. */
  placements?: ReadonlyMap<string, number>;
  /** 사용처를 읽었는지(읽기 전에는 미사용을 판정하지 않는다). */
  usageKnown?: boolean;
}

/**
 * 통계 표에서 이 파일의 항목을 찾되, **지금 배포된 파일과 같은 내용일 때만**
 * 돌려준다. 표는 스크립트로 미리 뽑아 둔 것이라 GLB 를 교체하고 다시 돌리지
 * 않으면 낡는다 — 낡은 수치를 보이느니 비워 둔다. 자산 해시 매니페스트에
 * 없는 파일(매니페스트 미주입 환경 등)은 비교할 수 없어 그대로 믿는다.
 */
function findFreshStatsEntry(
  version: AssetVersion,
  statsTable: AssetStatsTable,
): AssetStatsTableEntry | null {
  if (version.file.ref.storage !== 'public') return null;
  const entry = statsTable[version.file.ref.path];
  if (!entry) return null;
  const deployedHash = getAssetContentHash(version.file.ref.path);
  if (deployedHash !== null && deployedHash !== entry.hash) return null;
  return entry;
}

/**
 * 버전의 파일 크기 — 레코드에 없으면 배포 파일 통계 표에서 찾는다.
 * 어느 쪽에도 없으면 null.
 */
export function resolveVersionSizeBytes(
  version: AssetVersion,
  statsTable: AssetStatsTable,
): number | null {
  if (version.file.sizeBytes !== null) return version.file.sizeBytes;
  return findFreshStatsEntry(version, statsTable)?.bytes ?? null;
}

export function resolveVersionStats(
  version: AssetVersion,
  statsTable: AssetStatsTable,
): AssetStats | null {
  if (version.stats) return version.stats;
  return findFreshStatsEntry(version, statsTable)?.stats ?? null;
}

function matchesText(asset: AssetRecord, text: string): boolean {
  const needle = text.trim().toLowerCase();
  if (!needle) return true;
  const current = getCurrentAssetVersion(asset);
  const haystack = [
    asset.name,
    asset.id,
    asset.description,
    asset.drawingNo ?? '',
    current.file.fileName,
    ...asset.categories,
  ];
  return haystack.some((value) => value.toLowerCase().includes(needle));
}

/** 정렬 값이 없는 항목은 방향과 무관하게 맨 뒤로 보낸다. */
function compareNullable(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return 0;
}

export function queryAssets(
  assets: readonly AssetRecord[],
  query: AssetQuery,
  context: AssetQueryContext,
): AssetRecord[] {
  const collection =
    query.collectionId === null
      ? null
      : (context.collections.find((c) => c.id === query.collectionId) ?? null);
  const collectionIds = collection ? new Set(collection.assetIds) : null;
  const attentionContext = {
    statsTable: context.statsTable,
    placements: context.placements ?? EMPTY_PLACEMENTS,
    usageKnown: context.usageKnown ?? false,
  };

  const filtered = assets.filter((asset) => {
    if (query.kinds.length > 0 && !query.kinds.includes(asset.kind)) {
      return false;
    }
    if (
      query.statuses.length > 0 &&
      !query.statuses.includes(getCurrentAssetVersion(asset).status)
    ) {
      return false;
    }
    // 고른 카테고리를 모두 가진 자산만 — 카테고리를 더할수록 좁혀진다.
    if (!hasAllAssetCategories(asset.categories, query.categories)) return false;
    // 없는 컬렉션 id 는 "아무것도 속하지 않는다" 로 본다.
    if (query.collectionId !== null && !collectionIds?.has(asset.id)) {
      return false;
    }
    if (query.favoritesOnly && !context.favorites.has(asset.id)) return false;
    if (
      query.attention !== null &&
      !getAssetAttention(asset, attentionContext).includes(query.attention)
    ) {
      return false;
    }
    return matchesText(asset, query.text);
  });

  const byName = (a: AssetRecord, b: AssetRecord) =>
    a.name.localeCompare(b.name, undefined, { numeric: true });
  // 정렬 키마다 자연스러운 방향이 있다(이름은 가나다순, 나머지는 큰 것·최근
  // 것이 앞). `reverse` 는 그 방향을 뒤집는다 — 값을 모르는 항목은 어느
  // 방향에서도 맨 뒤다.
  const direction = query.reverse ? -1 : 1;
  const byNumber = (
    read: (asset: AssetRecord) => number | null,
  ): ((a: AssetRecord, b: AssetRecord) => number) => {
    return (a, b) => {
      const left = read(a);
      const right = read(b);
      if (left === null || right === null) {
        return compareNullable(left, right) || byName(a, b);
      }
      return direction * (right - left) || byName(a, b);
    };
  };

  switch (query.sort) {
    case 'updated':
      return filtered.sort((a, b) => {
        // 시각을 모르는 것(빈 문자열)은 뒤.
        if (!a.updatedAt || !b.updatedAt) {
          return (
            Number(!a.updatedAt) - Number(!b.updatedAt) || byName(a, b)
          );
        }
        return (
          direction * b.updatedAt.localeCompare(a.updatedAt) || byName(a, b)
        );
      });
    case 'size':
      return filtered.sort(
        byNumber((asset) =>
          resolveVersionSizeBytes(
            getCurrentAssetVersion(asset),
            context.statsTable,
          ),
        ),
      );
    case 'triangles':
      return filtered.sort(
        byNumber(
          (asset) =>
            resolveVersionStats(
              getCurrentAssetVersion(asset),
              context.statsTable,
            )?.triangles ?? null,
        ),
      );
    default:
      return filtered.sort((a, b) => direction * byName(a, b));
  }
}

export interface AssetFacets {
  total: number;
  kinds: Record<AssetKind, number>;
  statuses: Record<AssetVersionStatus, number>;
  /** 많이 쓰인 순. */
  categories: { category: string; count: number }[];
}

/** 필터 레일의 개수 표시용 집계 — 필터를 걸기 전 전체 기준이다. */
export function countAssetFacets(assets: readonly AssetRecord[]): AssetFacets {
  const kinds = Object.fromEntries(ASSET_KINDS.map((k) => [k, 0])) as Record<
    AssetKind,
    number
  >;
  const statuses = Object.fromEntries(
    ASSET_VERSION_STATUSES.map((s) => [s, 0]),
  ) as Record<AssetVersionStatus, number>;
  // 카테고리 필터가 대소문자를 가리지 않으므로 집계도 그렇게 묶는다. 표기는 먼저
  // 나온 것을 쓴다.
  const categoryCounts = new Map<string, { category: string; count: number }>();

  for (const asset of assets) {
    kinds[asset.kind] += 1;
    statuses[getCurrentAssetVersion(asset).status] += 1;
    for (const category of asset.categories) {
      const key = category.toLowerCase();
      const entry = categoryCounts.get(key);
      if (entry) entry.count += 1;
      else categoryCounts.set(key, { category, count: 1 });
    }
  }

  return {
    total: assets.length,
    kinds,
    statuses,
    categories: [...categoryCounts.values()].sort(
      (a, b) => b.count - a.count || a.category.localeCompare(b.category),
    ),
  };
}

/**
 * 같은 내용의 파일을 가진 버전 찾기 — 등록 전 중복 경고에 쓴다.
 *
 * 해시가 기록된 버전(이 화면에서 올린 것)은 해시로 비교한다. 배포 파일은
 * 레코드에 해시가 없으므로 통계 표로 비교한다 — 표의 해시는 SHA-256 의 앞
 * 8자리뿐이라 **바이트 크기까지 같을 때만** 같은 파일로 본다. SHA-256 이
 * 아닌 해시(폴백)로는 배포 파일과 비교할 수 없다.
 */
export function findAssetsByContentHash(
  assets: readonly AssetRecord[],
  contentHash: string,
  deployed?: { sizeBytes: number; statsTable: AssetStatsTable },
): { asset: AssetRecord; version: number }[] {
  if (!contentHash) return [];
  const sha = contentHash.startsWith('sha256:')
    ? contentHash.slice('sha256:'.length)
    : null;
  const matches: { asset: AssetRecord; version: number }[] = [];
  for (const asset of assets) {
    for (const version of asset.versions) {
      if (version.file.contentHash !== null) {
        if (version.file.contentHash === contentHash) {
          matches.push({ asset, version: version.version });
        }
        continue;
      }
      if (!deployed || sha === null) continue;
      const entry = findFreshStatsEntry(version, deployed.statsTable);
      if (
        entry &&
        entry.hash !== '' &&
        entry.bytes === deployed.sizeBytes &&
        sha.startsWith(entry.hash)
      ) {
        matches.push({ asset, version: version.version });
      }
    }
  }
  return matches;
}
