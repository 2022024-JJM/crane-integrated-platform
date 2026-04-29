import { useTranslation } from 'react-i18next';
import { Wrench } from 'lucide-react';
import { SectionCard } from './section-card';
import { MetricDonut } from './metric-donut';
import { MetricWithUnderline } from './metric-with-underline';
import { KCC_FILL } from '../constants/konecranes-colors';

interface OpenItemsPanelProps {
  totalOpen: number;
  safety: number;
  production: number;
}

export function OpenItemsPanel({ totalOpen, safety, production }: OpenItemsPanelProps) {
  const { t } = useTranslation('philly-dashboard');

  const segments = [
    { key: 'safety', value: safety, color: KCC_FILL.safety },
    { key: 'production', value: production, color: KCC_FILL.production },
  ];

  return (
    <SectionCard
      title={t('openItems.title')}
      variant="panel"
      accent="safety"
      icon={Wrench}
      href="/maintenance"
    >
      <div className="flex items-center justify-around gap-6">
        <div className="flex flex-col items-center gap-2">
          <MetricDonut segments={segments} centerNumber={totalOpen} size="lg" />
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            {t('openItems.openRisks')}
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border/80">
          <div className="px-8">
            <MetricWithUnderline
              value={safety}
              label={t('openItems.safety')}
              accent="safety"
              align="center"
              size="lg"
            />
          </div>
          <div className="px-8">
            <MetricWithUnderline
              value={production}
              label={t('openItems.production')}
              accent="production"
              align="center"
              size="lg"
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
