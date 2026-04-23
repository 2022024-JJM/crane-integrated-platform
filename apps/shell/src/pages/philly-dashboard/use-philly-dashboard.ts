import { useMemo } from 'react';
import { getAllCraneAssets } from '@crane/domain/asset';
import { getAllInspectionWOs } from '@crane/domain/inspection';
import { getAllRepairWOs } from '@crane/domain/maintenance';
import { getAllInventoryItems } from '@crane/domain/inventory';
import { getAllCertifications } from '@crane/domain/compliance';
import { useEntityTicks } from '@crane/features/shared';

export function usePhillyDashboard() {
  const tick = useEntityTicks(['asset', 'repair', 'inspection', 'parts']);

  return useMemo(() => {
    const assets = getAllCraneAssets();
    const inspections = getAllInspectionWOs();
    const repairs = getAllRepairWOs();
    const inventoryItems = getAllInventoryItems();
    const certifications = getAllCertifications();

    // ── Asset KPIs ──
    const totalCranes = assets.length;
    const operatingCranes = assets.filter((a) => a.status === 'operating').length;
    const downCranes = assets.filter((a) => a.status === 'repair').length;
    const warrantyExpiredCranes = assets.filter(
      (a) => new Date(a.warrantyEnd) < new Date(),
    ).length;

    // ── Inspection KPIs ──
    const overdue = inspections.filter((w) => w.status === 'overdue').length;
    const completedInspections = inspections.filter((w) => w.status === 'completed').length;
    const inspectionCompletionRate =
      inspections.length > 0
        ? Math.round((completedInspections / inspections.length) * 100)
        : 0;
    const failedInspections = inspections.filter((w) => w.result === 'fail').length;

    // ── Maintenance KPIs ──
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

    // ── Inventory KPIs ──
    const lowStockCount = inventoryItems.filter(
      (i) => i.status === 'low' || i.status === 'out_of_stock',
    ).length;
    const criticalLowStock = inventoryItems.filter(
      (i) => (i.status === 'low' || i.status === 'out_of_stock') && i.criticality === 'critical',
    ).length;

    // ── Compliance KPIs ──
    const expiredCerts = certifications.filter((c) => c.status === 'expired').length;
    const expiringSoonCerts = certifications.filter((c) => c.status === 'expiry_soon').length;

    // ── Recent Repair WOs (top 4) ──
    const recentRepairs = repairs
      .filter((w) => w.status !== 'completed')
      .sort((a, b) => {
        const priorityOrder = { emergency: 0, high: 1, normal: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 4);

    // ── Overdue / Active Inspections (top 4) ──
    const urgentInspections = inspections
      .filter((w) => w.status === 'overdue' || w.status === 'in_progress')
      .slice(0, 4);

    // ── Low stock critical parts (top 4) ──
    const criticalParts = inventoryItems
      .filter((i) => i.status === 'low' || i.status === 'out_of_stock')
      .sort((a, b) => {
        const critOrder = { critical: 0, essential: 1, standard: 2 };
        return critOrder[a.criticality] - critOrder[b.criticality];
      })
      .slice(0, 4);

    // ── Site breakdown ──
    const siteBreakdown = [
      { siteId: 'dock-1', siteKey: 'dock1', icon: 'outdoor' as const },
      { siteId: 'dock-2', siteKey: 'dock2', icon: 'outdoor' as const },
      { siteId: 'dock-in', siteKey: 'dockIn', icon: 'indoor' as const },
    ].map((site) => {
      const siteAssets = assets.filter((a) => a.siteId === site.siteId);
      const siteRepairs = repairs.filter(
        (r) => r.siteId === site.siteId && r.status !== 'completed',
      );
      const siteInspections = inspections.filter(
        (i) => i.siteId === site.siteId && i.status === 'overdue',
      );
      return {
        ...site,
        total: siteAssets.length,
        operating: siteAssets.filter((a) => a.status === 'operating').length,
        repair: siteAssets.filter((a) => a.status === 'repair').length,
        activeRepairs: siteRepairs.length,
        overdueInspections: siteInspections.length,
      };
    });

    return {
      // KPI metrics
      totalCranes,
      operatingCranes,
      downCranes,
      warrantyExpiredCranes,
      overdue,
      inspectionCompletionRate,
      failedInspections,
      activeRepairs,
      emergencyRepairs,
      waitingParts,
      avgMttrHours,
      lowStockCount,
      criticalLowStock,
      expiredCerts,
      expiringSoonCerts,
      // Lists
      recentRepairs,
      urgentInspections,
      criticalParts,
      siteBreakdown,
    };
  }, [tick]);
}
