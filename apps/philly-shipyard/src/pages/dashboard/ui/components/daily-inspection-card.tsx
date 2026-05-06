import { useTranslation } from 'react-i18next';
import { CalendarCheck } from 'lucide-react';
import { SectionCard } from './section-card';
import { MetricDonut } from './metric-donut';
import { MetricWithUnderline } from './metric-with-underline';
import { KCC_FILL } from '../constants/konecranes-colors';

interface DailyInspectionCardProps {
  passed: number;
  failed: number;
}

export function DailyInspectionCard({ passed, failed }: DailyInspectionCardProps) {
  const { t } = useTranslation('philly-dashboard');
  const total = passed + failed;

  const segments = [
    { key: 'failed', value: failed, color: KCC_FILL.safety },
    { key: 'passed', value: passed, color: KCC_FILL.success },
  ];

  return (
    <SectionCard
      title={t('dailyInspection.title')}
      icon={CalendarCheck}
      accent="success"
      caption={t('dailyInspection.subtitle', {
        defaultValue: "Operator's findings (last 7 days)",
      })}
      href="/inspection"
    >
      <div className="flex items-center gap-6">
        <MetricDonut
          segments={segments}
          centerNumber={total === 0 ? '0/0' : `${passed}/${total}`}
          size="md"
        />
        <div className="grid flex-1 grid-cols-2 divide-x divide-border">
          <div className="pr-4">
            <MetricWithUnderline
              value={failed}
              label={t('dailyInspection.failed')}
              accent="safety"
              align="left"
            />
          </div>
          <div className="pl-4">
            <MetricWithUnderline
              value={passed}
              label={t('dailyInspection.passed')}
              accent="success"
              align="left"
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
