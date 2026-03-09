import {
  MonitoringRegionCard,
  type MonitoringRegion,
} from '@/entities/monitoring-region';

const TEXT = {
  sectionLabel: '지역 선택',
} as const;

interface MainRegionOverviewProps {
  regions: MonitoringRegion[];
}

export function MainRegionOverview({ regions }: MainRegionOverviewProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-[18px] px-[clamp(20px,4vw,40px)] text-[11px] text-[var(--main-page-text-dim)] uppercase tracking-[0.14em] before:content-[''] before:w-0.75 before:h-3.5 before:rounded-full before:bg-[var(--main-page-accent)] after:content-[''] after:flex-1 after:h-px after:bg-[var(--main-page-border)]">
        {TEXT.sectionLabel}
      </div>
      <section className="grid [grid-template-columns:repeat(4,minmax(0,1fr))] gap-3.5 flex-1 px-[clamp(20px,4vw,40px)] pb-8 animate-[main-page-fade-up_0.5s_0.16s_ease_both] max-[1200px]:[grid-template-columns:repeat(3,minmax(0,1fr))] max-[960px]:[grid-template-columns:repeat(2,minmax(0,1fr))] max-[640px]:[grid-template-columns:minmax(0,1fr)]">
        {regions.map((region, index) => (
          <MonitoringRegionCard
            key={region.id}
            region={region}
            animationDelay={220 + index * 60}
          />
        ))}
      </section>
    </>
  );
}
