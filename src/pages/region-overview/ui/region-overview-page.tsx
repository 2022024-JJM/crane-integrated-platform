import { useState } from 'react';
import { LayoutGrid, Map } from 'lucide-react';
import { regions } from '@/entities/region';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/shared/ui/molecules/toggle-group';
import { RegionCard } from './region-card';
import { RegionMapView } from './region-map-view';

export function RegionOverviewPage() {
  const [view, setView] = useState<'card' | 'map'>('card');

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">구역 현황</h1>
          <p className="text-muted-foreground">
            도크별 크레인 운영 현황을 확인하고, 카드를 클릭하여 상세 페이지로
            이동합니다.
          </p>
        </div>

        <ToggleGroup
          value={[view]}
          onValueChange={(values) => {
            if (values.length > 0) {
              setView(values[values.length - 1] as 'card' | 'map');
            }
          }}
          className="bg-muted rounded-lg border"
        >
          <ToggleGroupItem
            value="card"
            aria-label="카드"
            className="text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground text-sm aria-pressed:shadow-sm"
          >
            <LayoutGrid className="mr-1.5 size-4" />
            카드
          </ToggleGroupItem>
          <ToggleGroupItem
            value="map"
            aria-label="지도"
            className="text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground text-sm aria-pressed:shadow-sm"
          >
            <Map className="mr-1.5 size-4" />
            지도
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {view === 'card' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 lg:grid-cols-6">
          {regions.map((region) => (
            <RegionCard key={region.id} region={region} />
          ))}
        </div>
      ) : (
        <RegionMapView />
      )}
    </div>
  );
}
