import { MonitoringRegionCard } from '@/entities/monitoring-region';
import type { MonitoringRegion } from '@/entities/monitoring-region';

interface MainRegionOverviewCardsProps {
  regions: MonitoringRegion[];
}

export function MainRegionOverviewCards({
  regions,
}: MainRegionOverviewCardsProps) {
  return (
    <section className="grid flex-1 animate-[main-page-fade-up_0.5s_0.16s_ease_both] [grid-template-columns:repeat(4,minmax(0,1fr))] gap-3.5 px-[clamp(20px,4vw,40px)] pb-8 max-[1200px]:[grid-template-columns:repeat(3,minmax(0,1fr))] max-[960px]:[grid-template-columns:repeat(2,minmax(0,1fr))] max-[640px]:[grid-template-columns:minmax(0,1fr)]">
      {regions.map((region, index) => (
        <MonitoringRegionCard
          key={region.id}
          region={region}
          animationDelay={220 + index * 60}
        />
      ))}
    </section>
  );
}
