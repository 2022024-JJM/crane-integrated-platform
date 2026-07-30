import { useTranslation } from 'react-i18next';
import { usePhillyDashboard } from '../model/use-philly-dashboard';
import { formatPeriodLabel } from '../model/aggregations';
import { PageHeaderBar } from './components/page-header-bar';
import { OpenItemsPanel } from './components/open-items-panel';
import { FleetStatusPanel } from './components/fleet-status-panel';
import { ActiveTicketsCard } from './components/active-tickets-card';
import { FleetSummaryCard } from './components/fleet-summary-card';
import { PAGE_CONTAINER } from '../../../shared/ui/page';

export function PhillyDashboardPage() {
  const { t, i18n } = useTranslation('philly-dashboard');
  const data = usePhillyDashboard();
  const periodLabel = formatPeriodLabel(data.now, i18n.language);

  return (
    <div className={PAGE_CONTAINER}>
      <PageHeaderBar periodLabel={periodLabel} />

      {/* Top: 2-Bay panels */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OpenItemsPanel risks={data.openRisks} />
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
            {t('sections.serviceSubtitle')}
          </span>
          <span aria-hidden className="ml-1 h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ActiveTicketsCard
            open={data.activeTickets.open}
            completed={data.activeTickets.completed}
            onHold={data.activeTickets.onHold}
          />
          <FleetSummaryCard
            cranes={data.cranes}
            byDay={data.inspectionByDay}
            overdueCount={data.totals.overdue}
          />
        </div>
      </section>
    </div>
  );
}
