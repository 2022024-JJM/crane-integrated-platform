import { useMemo } from 'react';
import { getAllCraneAssets } from '@crane/domain/asset';
import { getAllInspectionWOs } from '@crane/domain/inspection';
import { getAllRepairWOs } from '@crane/domain/maintenance';
import { getAllInventoryItems } from '@crane/domain/inventory';
import { getAllCertifications } from '@crane/domain/compliance';
import { useEntityTicks } from '@crane/features/shared';
import {
  aggregateRepairPipeline,
  aggregateSiteLoad,
  aggregateRepairWeeklyTrend,
  aggregateFailureMix,
  totalActiveRepairs,
} from './aggregations';

const TOP_N = 3;

export function usePhillyDashboard() {
  const tick = useEntityTicks(['asset', 'repair', 'inspection', 'parts']);

  return useMemo(() => {
    const assets = getAllCraneAssets();
    const inspections = getAllInspectionWOs();
    const repairs = getAllRepairWOs();
    const inventoryItems = getAllInventoryItems();
    const certifications = getAllCertifications();

    // ── KPI ────────────────────────────────────────────
    const totalCranes = assets.length;
    const operatingCranes = assets.filter((a) => a.status === 'operating').length;
    const downCranes = assets.filter((a) => a.status === 'repair').length;

    const overdue = inspections.filter((w) => w.status === 'overdue').length;
    const completedInspections = inspections.filter((w) => w.status === 'completed').length;
    const inspectionCompletionRate =
      inspections.length > 0
        ? Math.round((completedInspections / inspections.length) * 100)
        : 0;

    const activeRepairs = repairs.filter((w) =>
      ['in_progress', 're_inspection', 'waiting_parts', 'received'].includes(w.status),
    ).length;
    const emergencyRepairs = repairs.filter((w) => w.priority === 'emergency').length;
    const waitingParts = repairs.filter((w) => w.status === 'waiting_parts').length;

    const completedRepairs = repairs.filter((w) => w.status === 'completed');
    const totalDowntimeHours = completedRepairs.reduce(
      (sum, r) => sum + (r.downtimeHours ?? 0),
      0,
    );
    const avgMttrHours =
      completedRepairs.length > 0
        ? Math.round((totalDowntimeHours / completedRepairs.length) * 10) / 10
        : 0;

    const lowStockCount = inventoryItems.filter(
      (i) => i.status === 'low' || i.status === 'out_of_stock',
    ).length;
    const criticalLowStock = inventoryItems.filter(
      (i) =>
        (i.status === 'low' || i.status === 'out_of_stock') && i.criticality === 'critical',
    ).length;

    const expiredCerts = certifications.filter((c) => c.status === 'expired').length;
    const expiringSoonCerts = certifications.filter((c) => c.status === 'expiry_soon').length;

    // ── 차트 집계 ───────────────────────────────────────
    const repairPipeline = aggregateRepairPipeline(repairs);
    const activePipelineTotal = totalActiveRepairs(repairPipeline);
    const siteLoad = aggregateSiteLoad(assets);
    const repairWeeklyTrend = aggregateRepairWeeklyTrend(repairs, 8);
    const failureMix = aggregateFailureMix(repairs);

    // ── Top 3 리스트 ────────────────────────────────────
    const recentRepairs = repairs
      .filter((w) => w.status !== 'completed')
      .sort((a, b) => {
        const priorityOrder = { emergency: 0, high: 1, normal: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, TOP_N);

    const urgentInspections = inspections
      .filter((w) => w.status === 'overdue' || w.status === 'in_progress')
      .slice(0, TOP_N);

    const criticalParts = inventoryItems
      .filter((i) => i.status === 'low' || i.status === 'out_of_stock')
      .sort((a, b) => {
        const critOrder = { critical: 0, essential: 1, standard: 2 };
        return critOrder[a.criticality] - critOrder[b.criticality];
      })
      .slice(0, TOP_N);

    return {
      // KPI
      totalCranes,
      operatingCranes,
      downCranes,
      inspectionCompletionRate,
      overdue,
      activeRepairs,
      emergencyRepairs,
      waitingParts,
      avgMttrHours,
      lowStockCount,
      criticalLowStock,
      expiredCerts,
      expiringSoonCerts,
      // Charts
      repairPipeline,
      activePipelineTotal,
      siteLoad,
      repairWeeklyTrend,
      failureMix,
      // Top 3 lists
      recentRepairs,
      urgentInspections,
      criticalParts,
    };
  }, [tick]);
}

export type PhillyDashboardData = ReturnType<typeof usePhillyDashboard>;
