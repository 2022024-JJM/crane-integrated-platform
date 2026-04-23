import { useTranslation } from 'react-i18next';
import {
  getAllCraneAssets,
  getAssetSummary,
  getComponentsByCraneId,
  getCraneAssetById,
} from '@crane/domain/asset';
import { getAllInspectionWOs } from '@crane/domain/inspection';
import type { InspectionWO } from '@crane/domain/inspection';
import { getAllRepairWOs } from '@crane/domain/maintenance';
import type { RepairWO } from '@crane/domain/maintenance';
import { useEntityTicks } from '../shared/use-domain-event-store';

const ACTIVE_REPAIR_STATUSES = new Set(['received', 'waiting_parts', 'in_progress', 're_inspection']);

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

  return { assets, summary, craneInspectionMap, craneRepairMap };
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
