import { usePhillyDashboard } from './use-philly-dashboard';
import { DashboardHeader } from './components/dashboard-header';
import { DashboardAlertBanner } from './components/dashboard-alert-banner';
import { KpiStrip } from './components/kpi-strip';
import { RepairPipelineChart } from './components/repair-pipeline-chart';
import { SiteLoadChart } from './components/site-load-chart';
import { RepairTrendChart } from './components/repair-trend-chart';
import { FailureMixChart } from './components/failure-mix-chart';
import { TopListsStrip } from './components/top-lists-strip';

export function PhillyDashboardPage() {
  const {
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
    repairPipeline,
    activePipelineTotal,
    siteLoad,
    repairWeeklyTrend,
    failureMix,
    recentRepairs,
    urgentInspections,
    criticalParts,
  } = usePhillyDashboard();

  return (
    <div className="space-y-4 p-4 md:p-6">
      <DashboardHeader />

      <DashboardAlertBanner
        emergencyRepairs={emergencyRepairs}
        overdue={overdue}
        expiredCerts={expiredCerts}
      />

      <KpiStrip
        totalCranes={totalCranes}
        operatingCranes={operatingCranes}
        downCranes={downCranes}
        inspectionCompletionRate={inspectionCompletionRate}
        overdue={overdue}
        activeRepairs={activeRepairs}
        emergencyRepairs={emergencyRepairs}
        waitingParts={waitingParts}
        avgMttrHours={avgMttrHours}
        lowStockCount={lowStockCount}
        criticalLowStock={criticalLowStock}
        expiredCerts={expiredCerts}
        expiringSoonCerts={expiringSoonCerts}
      />

      {/* ── Chart Strip A ── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RepairPipelineChart data={repairPipeline} total={activePipelineTotal} />
        <SiteLoadChart data={siteLoad} />
      </section>

      {/* ── Chart Strip B ── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <RepairTrendChart data={repairWeeklyTrend} />
        <FailureMixChart data={failureMix} />
      </section>

      <TopListsStrip
        repairs={recentRepairs}
        inspections={urgentInspections}
        parts={criticalParts}
      />
    </div>
  );
}
