import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import { SectionCard } from './section-card';
import { MetricWithUnderline } from './metric-with-underline';

interface FleetStatusPanelProps {
  componentCritical: number;
  componentLow: number;
  alertSafety: number;
  alertProduction: number;
}

export function FleetStatusPanel({
  componentCritical,
  componentLow,
  alertSafety,
  alertProduction,
}: FleetStatusPanelProps) {
  const { t } = useTranslation('philly-dashboard');

  return (
    <SectionCard
      title={t('connectivity.title')}
      variant="panel"
      accent="info"
      icon={Activity}
      href="/asset-management"
    >
      <div className="grid grid-cols-2 divide-x divide-border/80">
        <Group title={t('connectivity.componentCondition')}>
          <MetricWithUnderline
            value={componentCritical}
            label={t('connectivity.critical')}
            accent="critical"
            align="center"
            size="lg"
          />
          <MetricWithUnderline
            value={componentLow}
            label={t('connectivity.low')}
            accent="low"
            align="center"
            size="lg"
          />
        </Group>
        <Group title={t('connectivity.operatingAlerts')}>
          <MetricWithUnderline
            value={alertSafety}
            label={t('openItems.safety')}
            accent="safety"
            align="center"
            size="lg"
          />
          <MetricWithUnderline
            value={alertProduction}
            label={t('openItems.production')}
            accent="production"
            align="center"
            size="lg"
          />
        </Group>
      </div>
    </SectionCard>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: [React.ReactNode, React.ReactNode];
}) {
  const [first, second] = children;
  return (
    <div className="flex flex-col items-center gap-3 px-4">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {title}
      </p>
      <div className="grid w-full grid-cols-2 divide-x divide-border/80">
        <div className="px-4">{first}</div>
        <div className="px-4">{second}</div>
      </div>
    </div>
  );
}
