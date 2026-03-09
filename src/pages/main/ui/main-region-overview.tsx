import {
  MonitoringRegionCard,
  type MonitoringRegion,
} from '@/entities/monitoring-region';

import './main-region-overview.css';

const TEXT = {
  sectionLabel: '\uc9c0\uc5ed \uc120\ud0dd',
  gridAria: '\uc9c0\uc5ed \ubaa9\ub85d',
} as const;

interface MainRegionOverviewProps {
  regions: MonitoringRegion[];
}

export function MainRegionOverview({ regions }: MainRegionOverviewProps) {
  return (
    <>
      <div className="main-page__section-label">{TEXT.sectionLabel}</div>
      <section className="main-page__grid" aria-label={TEXT.gridAria}>
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
