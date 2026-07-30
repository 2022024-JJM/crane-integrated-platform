import { useMemo } from 'react';
import { getAllCraneAssets } from '@crane/domain/asset';
import { getAllInspectionWOs } from '@crane/domain/inspection';
import { getAllRepairWOs } from '@crane/domain/maintenance';
import { getAllInventoryItems, getAllPartsRequests } from '@crane/domain/inventory';
import { getAllCertifications } from '@crane/domain/compliance';
import { useEntityTicks } from '@crane/features/shared';
import { computeOpenRisks } from '@crane/features/risk';
import { parseLocalDateTime } from '../../../shared/lib/relative-date';
import { aggregateInspectionPassFailByDay } from './aggregations';

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
    const downCranes = assets.filter((a) => a.status === 'repair').length;
    const inspectionCranes = assets.filter((a) => a.status === 'inspection').length;

    // ── Repairs ───────────────────────────────────────────
    const activeRepairs = repairs.filter((w) =>
      ['in_progress', 're_inspection', 'waiting_parts', 'received'].includes(w.status),
    ).length;
    // '즉시 조치'에 들어가는 값 — 완료된 긴급 건은 제외
    const emergencyRepairs = repairs.filter(
      (w) => w.priority === 'emergency' && w.status !== 'completed',
    ).length;
    const waitingParts = repairs.filter((w) => w.status === 'waiting_parts').length;
    const onHoldRepairs = repairs.filter((w) => w.status === 'on_hold').length;
    const completedThisMonth = repairs.filter((w) => {
      if (w.status !== 'completed' || !w.actualEnd) return false;
      const end = parseLocalDateTime(w.actualEnd);
      return end.getMonth() === now.getMonth() && end.getFullYear() === now.getFullYear();
    }).length;

    // ── Inspections ───────────────────────────────────────
    const overdue = inspections.filter((w) => w.status === 'overdue').length;

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
    const openRisks = computeOpenRisks({
      inspections,
      repairs,
      inventoryItems,
      partsRequests: getAllPartsRequests(),
    });
    const openSafetyCount = openRisks.safety.length;
    const openProductionCount = openRisks.production.length;
    const openTotalRisks = openRisks.risks.length;

    const componentCritical = downCranes;
    const componentLow = inspectionCranes + criticalLowStock;
    const alertSafety = expiredCerts + emergencyRepairs;
    const alertProduction = expiringSoonCerts + overdue;

    const inspectionByDay = aggregateInspectionPassFailByDay(inspections, now, 7);

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

      // Active tickets (Quotations 자리 대체)
      activeTickets: {
        open: activeRepairs,
        completed: completedThisMonth,
        onHold: onHoldRepairs,
      },

      // Asset Fleet — 실제 크레인 행 렌더용
      cranes: assets.map((a) => ({ id: a.id, name: a.name, status: a.status })),

      // 최근 7일 일자별 점검 결과 (미니 바)
      inspectionByDay,

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
