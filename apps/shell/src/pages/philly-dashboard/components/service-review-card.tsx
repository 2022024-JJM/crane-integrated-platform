import { useTranslation } from 'react-i18next';
import { ClipboardCheck } from 'lucide-react';
import { SectionCard } from './section-card';
import { MetricWithUnderline } from './metric-with-underline';

interface ServiceReviewCardProps {
  periodLabel: string;
  serviceVisits: number;
  assetsServiced: number;
  totalFindings: number;
}

export function ServiceReviewCard({
  periodLabel,
  serviceVisits,
  assetsServiced,
  totalFindings,
}: ServiceReviewCardProps) {
  const { t } = useTranslation('philly-dashboard');

  return (
    <SectionCard
      title={t('serviceReview.title')}
      icon={ClipboardCheck}
      accent="info"
      caption={periodLabel}
      href="/maintenance"
    >
      <div className="grid grid-cols-3 divide-x divide-border">
        <div className="px-2 first:pl-0 last:pr-0">
          <MetricWithUnderline
            value={serviceVisits}
            label={t('serviceReview.serviceVisits')}
            accent="info"
          />
        </div>
        <div className="px-2 first:pl-0 last:pr-0">
          <MetricWithUnderline
            value={assetsServiced}
            label={t('serviceReview.assetsServiced')}
            accent="info"
          />
        </div>
        <div className="px-2 first:pl-0 last:pr-0">
          <MetricWithUnderline
            value={totalFindings}
            label={t('serviceReview.totalFindings')}
            accent={totalFindings > 0 ? 'production' : 'success'}
          />
        </div>
      </div>
    </SectionCard>
  );
}
