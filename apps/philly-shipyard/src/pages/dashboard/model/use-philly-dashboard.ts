import { useMemo } from 'react';
import { getAllCraneAssets } from '@crane/domain/asset';
import { getAllInspectionWOs } from '@crane/domain/inspection';
import { getAllRepairWOs } from '@crane/domain/maintenance';
import { getAllInventoryItems } from '@crane/domain/inventory';
import { getAllCertifications } from '@crane/domain/compliance';
import { useEntityTicks } from '@crane/features/shared';
import { computeOpenRisks } from '@crane/features/risk';
import { parseLocalDateTime } from '../../../shared/lib/relative-date';
import {
  aggregateMonthlyServiceMetrics,
  aggregateInspectionPassFail,
} from './aggregations';

// Konecranes 패널 매핑:
// - openSafety/openProduction = computeOpenRisks 소견 단위 레지스터 (features/risk)
//   안전 = 미해소 점검 fail 소견 + 미완료 긴급 수리 + 기한 초과 점검
//   생산 = 부품 대기 수리 + 저재고/품절
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
    const completedThisMonth = repairs.filter((w) => {
      if (w.status !== 'completed' || !w.actualEnd) return false;
      const end = parseLocalDateTime(w.actualEnd);
      return end.getMonth() === now.getMonth() && end.getFullYear() === now.getFullYear();
    }).length;

    // ── Inspections ───────────────────────────────────────
    const overdue = inspections.filter((w) => w.status === 'overdue').length;
    // 점검 완료 자산 수 (건수가 아닌 distinct 크레인 — 분모 totalCranes와 단위 일치)
    const inspectedCraneCount = new Set(
      inspections.filter((w) => w.status === 'completed').map((w) => w.craneId),
    ).size;

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

    // ── Konecranes 패널 — 소견 단위 오픈 리스크 레지스터가 단일 소스 ──
    const openRisks = computeOpenRisks({ inspections, repairs, inventoryItems });
    const openSafetyCount = openRisks.safety.length;
    const openProductionCount = openRisks.production.length;
    const openTotalRisks = openRisks.risks.length;

    const componentCritical = downCranes;
    const componentLow = inspectionCranes + criticalLowStock;
    const alertSafety = expiredCerts + emergencyRepairs;
    const alertProduction = expiringSoonCerts + overdue;

    const serviceReview = aggregateMonthlyServiceMetrics(repairs, inspections, now);
    const dailyInspection = aggregateInspectionPassFail(inspections, now, 7);

    const agreementPct =
      totalCranes > 0 ? Math.round((operatingCranes / totalCranes) * 100) : 0;
    // 도넛 %와 분수(연결 자산/전체 자산)가 같은 지표를 가리키도록 통일
    const connectedPct =
      totalCranes > 0 ? Math.round((inspectedCraneCount / totalCranes) * 100) : 0;

    return {
      // Period
      now,

      // OpenItems panel
      openRisks,
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
        connectedCount: inspectedCraneCount,
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
