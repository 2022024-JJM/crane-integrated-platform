import type { MonitoringRegion } from '@/entities/monitoring-region';
import { cn } from '@/shared/lib/utils';

const TEXT = {
  totalRegions: '전체 지역',
  normalOperation: '정상 운영',
  warningDetected: '경고 감지',
  abnormalAlert: '이상 알림',
  totalCraneCount: '총 크레인 수',
} as const;

type SummaryTone = 'normal' | 'ok' | 'warning' | 'error';

function getSummaryValueClassName(tone: SummaryTone) {
  if (tone === 'ok') {
    return 'text-[var(--main-page-ok)]';
  }

  if (tone === 'warning') {
    return 'text-[var(--main-page-warn)]';
  }

  if (tone === 'error') {
    return 'text-[var(--main-page-error)]';
  }

  return 'text-[var(--main-page-text)]';
}

interface MainSummaryProps {
  regions: MonitoringRegion[];
}

function getSummaryItems(regions: MonitoringRegion[]) {
  const normalCount = regions.filter(
    (region) => region.status === 'normal',
  ).length;
  const warningCount = regions.filter(
    (region) => region.status === 'warning',
  ).length;
  const errorCount = regions.filter(
    (region) => region.status === 'error',
  ).length;
  const craneCount = regions.reduce(
    (total, region) => total + region.craneCount,
    0,
  );

  return [
    {
      label: TEXT.totalRegions,
      value: regions.length,
      tone: 'normal' as const,
    },
    { label: TEXT.normalOperation, value: normalCount, tone: 'ok' as const },
    {
      label: TEXT.warningDetected,
      value: warningCount,
      tone: 'warning' as const,
    },
    { label: TEXT.abnormalAlert, value: errorCount, tone: 'error' as const },
    { label: TEXT.totalCraneCount, value: craneCount, tone: 'normal' as const },
  ];
}

export function MainSummary({ regions }: MainSummaryProps) {
  const summaryItems = getSummaryItems(regions);

  return (
    <section className="grid grid-cols-5 gap-px mb-13 mx-10 border border-(--main-page-border) overflow-hidden bg-(--main-page-border) animate-[main-page-fade-up_0.5s_0.08s_ease_both] max-[960px]:grid-cols-3 max-[640px]:grid-cols-2">
      {summaryItems.map((item) => (
        <div
          key={item.label}
          className="px-4.5 py-3.5 bg-(--main-page-surface) flex flex-col gap-1"
        >
          <div className="text-[13px] text-(--main-page-text-dim) uppercase tracking-[0.14em]">
            {item.label}
          </div>
          <div
            className={cn(
              'font-["JetBrains_Mono",monospace] text-[20px] font-semibold',
              getSummaryValueClassName(item.tone),
            )}
          >
            {item.value}
          </div>
        </div>
      ))}
    </section>
  );
}
