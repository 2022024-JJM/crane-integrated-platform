import type { RepairWO } from '@crane/domain/maintenance';

/**
 * 중복 신고 방지 — 장비를 고른 순간 그 장비에 이미 열린 고장 신고를 보여 준다.
 * 같은 건이면 새로 올리지 않고 기존 신고에 사진만 덧붙이게 한다(현장 데이터
 * 오염의 가장 흔한 원인).
 */
export const OPEN_REPORTS_LIMIT = 3;

export function openRepairsForAsset(
  repairs: readonly RepairWO[],
  craneId: string | null,
  limit: number = OPEN_REPORTS_LIMIT,
): RepairWO[] {
  if (!craneId) return [];
  return repairs
    .filter((r) => r.craneId === craneId && r.status !== 'completed')
    .sort((a, b) =>
      a.scheduledStart < b.scheduledStart
        ? 1
        : a.scheduledStart > b.scheduledStart
          ? -1
          : 0,
    )
    .slice(0, limit);
}
