import { useTranslation } from 'react-i18next';
import {
  getAllCraneAssets,
  getAssetSummary,
  getComponentsByCraneId,
  getCraneAssetById,
} from '@crane/domain/asset';
import type { CraneComponent, ComponentStatus } from '@crane/domain/asset';
import { getAllInspectionWOs } from '@crane/domain/inspection';
import type { InspectionWO } from '@crane/domain/inspection';
import { getAllRepairWOs } from '@crane/domain/maintenance';
import type { RepairWO } from '@crane/domain/maintenance';
import { useEntityTicks } from '../shared/use-domain-event-store';

const ACTIVE_REPAIR_STATUSES = new Set(['received', 'waiting_parts', 'in_progress', 're_inspection']);

const STATUS_SEVERITY: Record<ComponentStatus, number> = {
  normal: 0,
  caution: 1,
  warning: 2,
  critical: 3,
  replace: 4,
};

export interface AssetHealthSnapshot {
  /** 0~100 — 잔여 수명 % (낮을수록 위험) */
  remainingPct: number;
  /** worst 부품 이름 */
  componentName: string;
  /** worst 부품 상태 */
  componentStatus: ComponentStatus;
  /** worst 부품 타입 (선택) */
  componentType: CraneComponent['componentType'];
}

function computeWorstHealth(components: CraneComponent[]): AssetHealthSnapshot | null {
  if (components.length === 0) return null;
  let worst = components[0];
  for (const c of components) {
    const cSev = STATUS_SEVERITY[c.status];
    const wSev = STATUS_SEVERITY[worst.status];
    if (cSev > wSev) {
      worst = c;
      continue;
    }
    if (cSev === wSev) {
      const cRem = c.expectedLifeHours > 0 ? c.currentHours / c.expectedLifeHours : 1;
      const wRem = worst.expectedLifeHours > 0 ? worst.currentHours / worst.expectedLifeHours : 1;
      if (cRem > wRem) worst = c;
    }
  }
  const usedRatio =
    worst.expectedLifeHours > 0
      ? Math.min(1, worst.currentHours / worst.expectedLifeHours)
      : 0;
  const remainingPct = Math.max(0, Math.round((1 - usedRatio) * 100));
  return {
    remainingPct,
    componentName: worst.componentName,
    componentStatus: worst.status,
    componentType: worst.componentType,
  };
}

function pickLatestDate(...dates: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  for (const d of dates) {
    if (!d) continue;
    if (!latest || new Date(d).getTime() > new Date(latest).getTime()) {
      latest = d;
    }
  }
  return latest;
}

export function useAssetList() {
  useEntityTicks(['asset', 'repair', 'inspection']);
  const assets = getAllCraneAssets();
  const summary = getAssetSummary();

  const allInspections = getAllInspectionWOs();
  const allRepairs = getAllRepairWOs();

  const craneInspectionMap: Record<string, { overdueCount: number }> = {};
  for (const wo of allInspections) {
    if (wo.status === 'overdue') {
      craneInspectionMap[wo.craneId] = {
        overdueCount: (craneInspectionMap[wo.craneId]?.overdueCount ?? 0) + 1,
      };
    }
  }

  const craneRepairMap: Record<string, { activeCount: number }> = {};
  for (const wo of allRepairs) {
    if (ACTIVE_REPAIR_STATUSES.has(wo.status)) {
      craneRepairMap[wo.craneId] = {
        activeCount: (craneRepairMap[wo.craneId]?.activeCount ?? 0) + 1,
      };
    }
  }

  // Per-crane health + last activity
  const craneHealthMap: Record<string, AssetHealthSnapshot> = {};
  const craneLastActivityMap: Record<string, string> = {};

  // 마지막 점검/수리 일자 집계
  const lastInspectionByAsset: Record<string, string | null> = {};
  for (const wo of allInspections) {
    if (!wo.actualDate) continue;
    const prev = lastInspectionByAsset[wo.craneId];
    if (!prev || new Date(wo.actualDate).getTime() > new Date(prev).getTime()) {
      lastInspectionByAsset[wo.craneId] = wo.actualDate;
    }
  }
  const lastRepairByAsset: Record<string, string | null> = {};
  for (const wo of allRepairs) {
    if (!wo.actualEnd) continue;
    const prev = lastRepairByAsset[wo.craneId];
    if (!prev || new Date(wo.actualEnd).getTime() > new Date(prev).getTime()) {
      lastRepairByAsset[wo.craneId] = wo.actualEnd;
    }
  }

  for (const asset of assets) {
    const components = getComponentsByCraneId(asset.id);
    const health = computeWorstHealth(components);
    if (health) craneHealthMap[asset.id] = health;
    const last = pickLatestDate(
      lastInspectionByAsset[asset.id],
      lastRepairByAsset[asset.id],
    );
    if (last) craneLastActivityMap[asset.id] = last;
  }

  return {
    assets,
    summary,
    craneInspectionMap,
    craneRepairMap,
    craneHealthMap,
    craneLastActivityMap,
  };
}

export function useAssetDetail(craneId: string) {
  const { i18n } = useTranslation();
  const isKo = i18n.language === 'ko';
  useEntityTicks(['asset', 'repair', 'inspection']);

  const asset = getCraneAssetById(craneId);
  const components = getComponentsByCraneId(craneId);

  const inspections: InspectionWO[] = getAllInspectionWOs()
    .filter((w) => w.craneId === craneId)
    .map((w) =>
      isKo && w.findings_ko ? { ...w, findings: w.findings_ko } : w,
    );

  const repairs: RepairWO[] = getAllRepairWOs()
    .filter((w) => w.craneId === craneId)
    .map((w) =>
      isKo
        ? {
            ...w,
            componentName: w.componentName_ko ?? w.componentName,
            failureDescription: w.failureDescription_ko ?? w.failureDescription,
          }
        : w,
    );

  return { asset, components, inspections, repairs };
}
