import { LayoutGrid, Map } from 'lucide-react';

import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/shared/ui/molecules/toggle-group';
import type { RegionViewMode } from '@/features/main-region-overview/model/use-main-region-overview-mode';
import { useMainRegionOverviewMode } from '@/features/main-region-overview/model/use-main-region-overview-mode';
import { MainRegionOverviewCards } from '@/features/main-region-overview/ui/main-region-overview-cards';
import { MainRegionOverviewMap } from '@/features/main-region-overview/ui/main-region-overview-map';
import type { MonitoringRegion } from '@/entities/monitoring-region';

const TEXT = {
  sectionLabel: '지역 선택',
  cardLabel: '카드 형',
  mapLabel: '지도 형',
} as const;

interface MainRegionOverviewProps {
  regions: MonitoringRegion[];
}

function isRegionMode(value: string | undefined): value is RegionViewMode {
  return value === 'card' || value === 'map';
}

export function MainRegionOverview({ regions }: MainRegionOverviewProps) {
  const { mode, setMode } = useMainRegionOverviewMode();

  const handleModeChange = (value: string | undefined) => {
    if (isRegionMode(value)) {
      setMode(value);
    }
  };

  return (
    <>
      <div className="mb-[18px] flex items-center gap-3 px-[clamp(20px,4vw,40px)]">
        <div className="flex min-w-0 flex-1 items-center gap-3 text-[13px] tracking-[0.14em] text-[var(--main-page-text-dim)] uppercase before:h-3.5 before:w-0.75 before:rounded-full before:bg-[var(--main-page-accent)] before:content-[''] after:h-px after:flex-1 after:bg-[var(--main-page-border)] after:content-['']">
          {TEXT.sectionLabel}
        </div>
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={handleModeChange}
          variant="outline"
          size="sm"
          spacing={0}
          className="rounded-[8px] border-(--main-page-border) bg-(--main-page-surface)"
        >
          <ToggleGroupItem
            value="card"
            aria-label={`${TEXT.cardLabel} 보기`}
            className="min-w-[74px] text-[11px] text-[var(--main-page-text)]"
          >
            <LayoutGrid className="size-3.5" />
            <span>{TEXT.cardLabel}</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="map"
            aria-label={`${TEXT.mapLabel} 보기`}
            className="min-w-[74px] text-[11px] text-[var(--main-page-text)]"
          >
            <Map className="size-3.5" />
            <span>{TEXT.mapLabel}</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {mode === 'card' ? (
        <MainRegionOverviewCards regions={regions} />
      ) : (
        <MainRegionOverviewMap regions={regions} />
      )}
    </>
  );
}
