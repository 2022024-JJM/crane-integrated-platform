import type { CraneSnapshotEntry } from '@crane/features/3d';

export interface BayOption {
  bay: string;
  count: number;
}

/** 구역 칩 — 스냅샷에 나타난 bay 를 사전순으로, 각 크레인 수와 함께. bay 가 없는 크레인은 칩에 안 올린다. */
export function collectBays(
  order: readonly string[],
  cranes: Record<string, Pick<CraneSnapshotEntry, 'snapshot'>>,
): BayOption[] {
  const counts = new Map<string, number>();
  for (const id of order) {
    const bay = cranes[id]?.snapshot.bay;
    if (!bay) continue;
    counts.set(bay, (counts.get(bay) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
    .map(([bay, count]) => ({ bay, count }));
}

/**
 * 목록 필터 — 구역 칩('all' 이면 전부) 과 크레인 ID 부분 일치(대소문자·앞뒤
 * 공백 무시). 순서는 `order` 그대로.
 */
export function filterCraneIds(
  order: readonly string[],
  cranes: Record<string, Pick<CraneSnapshotEntry, 'snapshot'>>,
  bay: string | 'all',
  query: string,
): string[] {
  const needle = query.trim().toLowerCase();
  return order.filter((id) => {
    const entry = cranes[id];
    if (!entry) return false;
    if (bay !== 'all' && entry.snapshot.bay !== bay) return false;
    return !needle || id.toLowerCase().includes(needle);
  });
}

/** 온라인 크레인 수(서버 `online` 기준). */
export function countOnline(
  order: readonly string[],
  cranes: Record<string, Pick<CraneSnapshotEntry, 'snapshot'>>,
): number {
  let online = 0;
  for (const id of order) if (cranes[id]?.snapshot.online) online += 1;
  return online;
}
