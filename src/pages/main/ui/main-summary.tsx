import type { MonitoringRegion } from '@/entities/monitoring-region';
import { cn } from '@/shared/lib/utils';

const TEXT = {
  totalRegions: '\uc804\uccb4 \uc9c0\uc5ed',
  normalOperation: '\uc815\uc0c1 \uc6b4\uc601',
  warningDetected: '\uacbd\uace0 \uac10\uc9c0',
  abnormalAlert: '\uc774\uc0c1 \uc54c\ub9bc',
  totalCraneCount: '\ucd1d \ud06c\ub808\uc778 \uc218',
  summaryAria: '\uc6b4\uc601 \uc694\uc57d',
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
    <section
      className="grid [grid-template-columns:repeat(5,minmax(0,1fr))] gap-px mb-9 px-[clamp(20px,4vw,40px)] border border-[var(--main-page-border)] rounded-[8px] overflow-hidden bg-[var(--main-page-border)] animate-[main-page-fade-up_0.5s_0.08s_ease_both] max-[960px]:[grid-template-columns:repeat(3,minmax(0,1fr))] max-[640px]:[grid-template-columns:repeat(2,minmax(0,1fr))]"
      aria-label={TEXT.summaryAria}
    >
      {summaryItems.map((item) => (
        <div
          key={item.label}
          className="px-[18px] py-[14px] bg-[var(--main-page-surface)] flex flex-col gap-1"
        >
          <div className="text-[10px] text-[var(--main-page-text-dim)] uppercase tracking-[0.14em]">
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
