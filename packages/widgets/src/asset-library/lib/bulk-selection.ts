import {
  ASSET_VERSION_STATUSES,
  getAllowedStatusTransitions,
  getAssetRemoveBlock,
  getCurrentAssetVersion,
  type AssetRecord,
  type AssetUsageState,
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

/**
 * 고른 자산 가운데 지울 수 있는 수와 막힌 수. 막히는 것은 씬이나 화면 코드가
 * 쓰는 자산과, 사용처를 다 읽지 못해 안 쓰이는지 알 수 없는 자산이다
 * (`getAssetRemoveBlock`). 일괄 삭제 버튼과 확인 창이 이 둘을 적는다.
 */
export function countBulkRemovable(
  selected: readonly AssetRecord[],
  usage: AssetUsageState,
): { removable: number; blocked: number } {
  let removable = 0;
  for (const asset of selected) {
    if (getAssetRemoveBlock(asset, usage) === null) removable += 1;
  }
  return { removable, blocked: selected.length - removable };
}

/** 고른 자산들이 가진 카테고리 — 많이 쓰인 순, 대소문자를 가리지 않고 묶는다. */
export function listBulkCategories(selected: readonly AssetRecord[]): string[] {
  const counts = new Map<string, { category: string; count: number }>();
  for (const asset of selected) {
    for (const category of asset.categories) {
      const key = category.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { category, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
    .map((entry) => entry.category);
}

/** 카테고리 하나를 뺀 목록. 없으면 null(바꿀 것이 없다). */
export function withoutCategory(
  categories: readonly string[],
  category: string,
): string[] | null {
  const key = category.toLowerCase();
  const next = categories.filter((item) => item.toLowerCase() !== key);
  return next.length === categories.length ? null : next;
}

/** 카테고리 하나를 더한 목록. 이미 있으면 null. */
export function withCategory(categories: readonly string[], category: string): string[] | null {
  const key = category.toLowerCase();
  return categories.some((item) => item.toLowerCase() === key)
    ? null
    : [...categories, category];
}
