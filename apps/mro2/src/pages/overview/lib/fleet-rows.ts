import type { CraneAsset } from '@crane/domain/asset';
import type { AssetHealthSnapshot } from '@crane/features/asset';
import { inspectionDue } from '../../assets/lib/asset-card-metrics';

/** 개요 "관심 자산" 한 줄 — 점검이 밀렸거나 건강도가 낮은 순. */
export interface WatchAsset {
  id: string;
  name: string;
  status: CraneAsset['status'];
  healthPct: number | undefined;
  overdueDays: number;
}

export const WATCH_LIMIT = 5;

export function buildWatchAssets(
  assets: readonly CraneAsset[],
  healthById: Readonly<Record<string, AssetHealthSnapshot | undefined>>,
  nextInspectionById: Readonly<Record<string, string | undefined>>,
  now: number,
  limit: number = WATCH_LIMIT,
): WatchAsset[] {
  return assets
    .filter((a) => a.status !== 'decommissioned')
    .map((a) => {
      const due = inspectionDue(nextInspectionById[a.id], now);
      return {
        id: a.id,
        name: a.name,
        status: a.status,
        healthPct: healthById[a.id]?.remainingPct,
        overdueDays: due.kind === 'overdue' ? due.days : 0,
      };
    })
    .sort(
      (x, y) =>
        y.overdueDays - x.overdueDays ||
        (x.healthPct ?? 101) - (y.healthPct ?? 101) ||
        x.name.localeCompare(y.name),
    )
    .slice(0, Math.max(0, limit));
}
