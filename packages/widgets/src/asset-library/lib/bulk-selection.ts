import {
  ASSET_VERSION_STATUSES,
  getAllowedStatusTransitions,
  getCurrentAssetVersion,
  type AssetRecord,
  type AssetVersionStatus,
} from '@crane/domain/asset-library';

/**
 * 고른 자산들에 대한 집계 — 일괄 작업 줄이 "지금 실제로 걸리는 것" 만 메뉴로
 * 내는 데 쓴다.
 */

/** 걸 수 있는 상태 전환과 그것이 걸리는 자산 수. 상태 표의 순서로 낸다. */
export function listBulkTransitions(
  selected: readonly AssetRecord[],
): { to: AssetVersionStatus; count: number }[] {
  const counts = new Map<AssetVersionStatus, number>();
  for (const asset of selected) {
    const status = getCurrentAssetVersion(asset).status;
    for (const to of getAllowedStatusTransitions(status)) {
      counts.set(to, (counts.get(to) ?? 0) + 1);
    }
  }
  return ASSET_VERSION_STATUSES.filter((to) => counts.has(to)).map((to) => ({
    to,
    count: counts.get(to) ?? 0,
  }));
}

/** 고른 자산들이 가진 태그 — 많이 쓰인 순, 대소문자를 가리지 않고 묶는다. */
export function listBulkTags(selected: readonly AssetRecord[]): string[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const asset of selected) {
    for (const tag of asset.tags) {
      const key = tag.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { tag, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .map((entry) => entry.tag);
}

/** 태그 하나를 뺀 목록. 없으면 null(바꿀 것이 없다). */
export function withoutTag(
  tags: readonly string[],
  tag: string,
): string[] | null {
  const key = tag.toLowerCase();
  const next = tags.filter((item) => item.toLowerCase() !== key);
  return next.length === tags.length ? null : next;
}

/** 태그 하나를 더한 목록. 이미 있으면 null. */
export function withTag(tags: readonly string[], tag: string): string[] | null {
  const key = tag.toLowerCase();
  return tags.some((item) => item.toLowerCase() === key)
    ? null
    : [...tags, tag];
}
