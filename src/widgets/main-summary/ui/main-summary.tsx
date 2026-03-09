import type { MonitoringRegion } from '@/entities/monitoring-region';
import { cn } from '@/shared/lib/utils';

import './main-summary.css';

const TEXT = {
  totalRegions: '\uc804\uccb4 \uc9c0\uc5ed',
  normalOperation: '\uc815\uc0c1 \uc6b4\uc601',
  warningDetected: '\uacbd\uace0 \uac10\uc9c0',
  abnormalAlert: '\uc774\uc0c1 \uc54c\ub9bc',
  totalCraneCount: '\ucd1d \ud06c\ub808\uc778 \uc218',
  summaryAria: '\uc6b4\uc601 \uc694\uc57d',
} as const;

interface MainSummaryProps {
  regions: MonitoringRegion[];
}

function getSummaryItems(regions: MonitoringRegion[]) {
  const normalCount = regions.filter((region) => region.status === 'normal').length;
  const warningCount = regions.filter((region) => region.status === 'warning').length;
  const errorCount = regions.filter((region) => region.status === 'error').length;
  const craneCount = regions.reduce((total, region) => total + region.craneCount, 0);

  return [
    { label: TEXT.totalRegions, value: regions.length, tone: 'normal' as const },
    { label: TEXT.normalOperation, value: normalCount, tone: 'ok' as const },
    { label: TEXT.warningDetected, value: warningCount, tone: 'warning' as const },
    { label: TEXT.abnormalAlert, value: errorCount, tone: 'error' as const },
    { label: TEXT.totalCraneCount, value: craneCount, tone: 'normal' as const },
  ];
}

export function MainSummary({ regions }: MainSummaryProps) {
  const summaryItems = getSummaryItems(regions);

  return (
    <section className="main-page__summary" aria-label={TEXT.summaryAria}>
      {summaryItems.map((item) => (
        <div key={item.label} className="main-page__summary-card">
          <div className="main-page__summary-label">{item.label}</div>
          <div
            className={cn(
              'main-page__summary-value',
              `main-page__summary-value--${item.tone}`,
            )}
          >
            {item.value}
          </div>
        </div>
      ))}
    </section>
  );
}
