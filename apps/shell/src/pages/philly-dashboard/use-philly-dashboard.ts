import { useMemo } from 'react';
import { getAllCraneAssets } from '@crane/domain/asset';
import { getAllInspectionWOs } from '@crane/domain/inspection';
import { getAllRepairWOs } from '@crane/domain/maintenance';
import { getAllInventoryItems } from '@crane/domain/inventory';
import { getAllCertifications } from '@crane/domain/compliance';
import { useEntityTicks } from '@crane/features/shared';
import {
  aggregateMonthlyServiceMetrics,
  aggregateInspectionPassFail,
} from './aggregations';

// Konecranes 패널 매핑 휴리스틱:
// - openSafety   = emergencyRepairs + overdueInspections (안전 영향)
// - openProduction = waitingParts + lowStockCount (생산 지연)
// - alertSafety  = expiredCerts + emergencyRepairs (즉시 조치)
// - alertProduction = expiringSoonCerts + overdue (예방 조치)

export function usePhillyDashboard() {
  const tick = useEntityTicks(['asset', 'repair', 'inspection', 'parts']);

  return useMemo(() => {
    const now = new Date();
    const assets = getAllCraneAssets();
    const inspections = getAllInspectionWOs();
    const repairs = getAllRepairWOs();
    const inventoryItems = getAllInventoryItems();
    const certifications = getAllCertifications();

    // ── Asset / Operation ─────────────────────────────────
    const totalCranes = assets.length;
    const operatingCranes = assets.filter((a) => a.status === 'operating').length;
    const downCranes = assets.filter((a) => a.status === 'repair').length;
    const inspectionCranes = assets.filter((a) => a.status === 'inspection').length;

    // ── Repairs ───────────────────────────────────────────
    const activeRepairs = repairs.filter((w) =>
      ['in_progress', 're_inspection', 'waiting_parts', 'received'].includes(w.status),
    ).length;
    const emergencyRepairs = repairs.filter((w) => w.priority === 'emergency').length;
    const waitingParts = repairs.filter((w) => w.status === 'waiting_parts').length;
    const onHoldRepairs = repairs.filter((w) => w.status === 'on_hold').length;
    const completedThisMonth = repairs.filter(
      (w) =>
        w.status === 'completed' &&
        w.actualEnd &&
        new Date(w.actualEnd).getMonth() === now.getMonth() &&
        new Date(w.actualEnd).getFullYear() === now.getFullYear(),
    ).length;

    // ── Inspections ───────────────────────────────────────
    const overdue = inspections.filter((w) => w.status === 'overdue').length;
    const completedInspections = inspections.filter((w) => w.status === 'completed').length;
    const inspectionCompletionRate =
      inspections.length > 0
        ? Math.round((completedInspections / inspections.length) * 100)
        : 0;

    // ── Inventory ─────────────────────────────────────────
    const lowStockCount = inventoryItems.filter(
      (i) => i.status === 'low' || i.status === 'out_of_stock',
    ).length;
    const criticalLowStock = inventoryItems.filter(
      (i) =>
        (i.status === 'low' || i.status === 'out_of_stock') && i.criticality === 'critical',
    ).length;

    // ── Compliance ────────────────────────────────────────
    const expiredCerts = certifications.filter((c) => c.status === 'expired').length;
    const expiringSoonCerts = certifications.filter((c) => c.status === 'expiry_soon').length;

    // ── Konecranes 패널 ───────────────────────────────────
    const openSafetyCount = emergencyRepairs + overdue;
    const openProductionCount = waitingParts + lowStockCount;
    const openTotalRisks = openSafetyCount + openProductionCount;

    const componentCritical = downCranes;
    const componentLow = inspectionCranes + criticalLowStock;
    const alertSafety = expiredCerts + emergencyRepairs;
    const alertProduction = expiringSoonCerts + overdue;

    const serviceReview = aggregateMonthlyServiceMetrics(repairs, inspections, now);
    const dailyInspection = aggregateInspectionPassFail(inspections, now, 7);

    const agreementPct =
      totalCranes > 0 ? Math.round((operatingCranes / totalCranes) * 100) : 0;
    const connectedPct = inspectionCompletionRate;

    return {
      // Period
      now,

      // OpenItems panel
      openTotalRisks,
      openSafetyCount,
      openProductionCount,

      // Fleet status panel
      componentCritical,
      componentLow,
      alertSafety,
      alertProduction,

      // Service review
      serviceReview,

      // Active tickets (Quotations 자리 대체)
      activeTickets: {
        open: activeRepairs,
        completed: completedThisMonth,
        onHold: onHoldRepairs,
      },

      // Asset Fleet
      assetFleet: {
        agreementPct,
        connectedPct,
        totalAssets: totalCranes,
        operatingCranes,
        connectedCount: completedInspections,
      },

      // Daily inspection
      dailyInspection,

      // Counts surfaced for tooltips/aria
      totals: {
        totalCranes,
        emergencyRepairs,
        overdue,
        waitingParts,
        lowStockCount,
        criticalLowStock,
        expiredCerts,
        expiringSoonCerts,
      },
    };
    // tick은 mutation 발생 시 재계산을 강제하는 외부 신호
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
}

export type PhillyDashboardData = ReturnType<typeof usePhillyDashboard>;
