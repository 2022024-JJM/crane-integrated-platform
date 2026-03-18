import { useMemo } from 'react';
import { LayoutGrid, Map } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { regions } from '@/entities/region';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/shared/ui/molecules/toggle-group';
import { RegionCard } from './region-card';
import { RegionMap } from './region-map';

type RegionOverviewView = 'card' | 'map';

export function RegionOverviewPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = useMemo<RegionOverviewView>(() => {
    const requestedView = searchParams.get('view');

    return requestedView === 'map' ? 'map' : 'card';
  }, [searchParams]);

  const handleViewChange = (values: string[]) => {
    if (values.length === 0) {
      return;
    }

    const nextView = values[values.length - 1];
    if (nextView !== 'card' && nextView !== 'map') {
      return;
    }

    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);

      if (nextView === 'card') {
        nextParams.delete('view');
      } else {
        nextParams.set('view', nextView);
      }

      return nextParams;
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('region-overview:title')}
          </h1>
          <p className="text-muted-foreground">
            {t('region-overview:description')}
          </p>
        </div>

        <ToggleGroup
          value={[view]}
          onValueChange={handleViewChange}
          className="bg-muted rounded-lg border"
        >
          <ToggleGroupItem
            value="card"
            aria-label={t('region-overview:cardView')}
            className="text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground text-sm aria-pressed:shadow-sm"
          >
            <LayoutGrid className="mr-1.5 size-4" />
            {t('region-overview:cardView')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="map"
            aria-label={t('region-overview:mapView')}
            className="text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground text-sm aria-pressed:shadow-sm"
          >
            <Map className="mr-1.5 size-4" />
            {t('region-overview:mapView')}
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
        <RegionMap />
      )}
    </div>
  );
}
