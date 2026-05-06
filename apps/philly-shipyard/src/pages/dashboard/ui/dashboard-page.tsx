import { useTranslation } from 'react-i18next';
import { usePhillyDashboard } from '../model/use-philly-dashboard';
import { formatPeriodLabel } from '../model/aggregations';
import { PageHeaderBar } from './components/page-header-bar';
import { OpenItemsPanel } from './components/open-items-panel';
import { FleetStatusPanel } from './components/fleet-status-panel';
import { ServiceReviewCard } from './components/service-review-card';
import { ActiveTicketsCard } from './components/active-tickets-card';
import { AssetFleetCard } from './components/asset-fleet-card';
import { DailyInspectionCard } from './components/daily-inspection-card';
import { QuickLinksList } from './components/quick-links-list';

export function PhillyDashboardPage() {
  const { t, i18n } = useTranslation('philly-dashboard');
  const data = usePhillyDashboard();
  const periodLabel = formatPeriodLabel(data.now, i18n.language);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeaderBar periodLabel={periodLabel} />

      {/* Top: 2-Bay panels */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OpenItemsPanel
          totalOpen={data.openTotalRisks}
          safety={data.openSafetyCount}
          production={data.openProductionCount}
        />
        <FleetStatusPanel
          componentCritical={data.componentCritical}
          componentLow={data.componentLow}
          alertSafety={data.alertSafety}
          alertProduction={data.alertProduction}
        />
      </section>

      {/* Service section */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-3 px-1">
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            {t('sections.service')}
          </h2>
          <span className="text-muted-foreground text-xs">
            {t('sections.serviceSubtitle', { defaultValue: '핵심 운영 지표' })}
          </span>
          <span aria-hidden className="ml-1 h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ServiceReviewCard
            periodLabel={periodLabel}
            serviceVisits={data.serviceReview.visits}
            assetsServiced={data.serviceReview.assets}
            totalFindings={data.serviceReview.findings}
          />
          <ActiveTicketsCard
            periodLabel={periodLabel}
            open={data.activeTickets.open}
            completed={data.activeTickets.completed}
            onHold={data.activeTickets.onHold}
          />
          <AssetFleetCard
            agreementPct={data.assetFleet.agreementPct}
            connectedPct={data.assetFleet.connectedPct}
            totalAssets={data.assetFleet.totalAssets}
            operatingCranes={data.assetFleet.operatingCranes}
            connectedCount={data.assetFleet.connectedCount}
          />
          <DailyInspectionCard
            passed={data.dailyInspection.passed}
            failed={data.dailyInspection.failed}
          />
        </div>
      </section>

      {/* Quick links */}
      <QuickLinksList />
    </div>
  );
}
