import type { KeyboardEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdvancedMarker, APIProvider, Map } from '@vis.gl/react-google-maps';

import { cn } from '@crane/core/lib/utils';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { useTheme } from '@crane/core/lib/theme-context';
import {
  getRegionTitleKey,
  regions,
  type LatLng,
  type Region,
} from '@crane/domain/region';
import {
  getStatusPalette,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
} from '../model/region-map-types';

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

type RegionMarkerData = Region & { center: LatLng };

export function RegionMap() {
  const { t } = useTranslation();

  if (!apiKey) {
    return (
      <section className="relative flex flex-1 items-center justify-center rounded-2xl border border-dashed p-8 text-center">
        <div className="max-w-md space-y-2">
          <p className="text-foreground text-base font-semibold">
            {t('monitoring-overview:map.missingApiKey.title')}
          </p>
          <p className="text-muted-foreground text-sm">
            {t('monitoring-overview:map.missingApiKey.description')}
          </p>
          <code className="text-muted-foreground bg-muted/60 mt-2 inline-block rounded px-2 py-1 text-xs">
            VITE_GOOGLE_MAPS_API_KEY
          </code>
        </div>
      </section>
    );
  }

  return (
    <section className="relative flex flex-1 overflow-hidden rounded-2xl border">
      <APIProvider apiKey={apiKey}>
        <RegionMapInner />
      </APIProvider>
    </section>
  );
}

function RegionMapInner() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const navigate = useProgressNavigate();
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  const regionsWithCenter = useMemo(() => regions.filter(hasRegionCenter), []);

  const handleNavigate = useCallback(
    (region: RegionMarkerData) => {
      navigate(region.navigateTo);
    },
    [navigate],
  );

  const toggleSelectedRegion = useCallback((regionId: string) => {
    setSelectedRegionId((current) => (current === regionId ? null : regionId));
  }, []);

  const handleMarkerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, regionId: string) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      toggleSelectedRegion(regionId);
    },
    [toggleSelectedRegion],
  );

  return (
    <Map
      mapId={mapId}
      defaultCenter={MAP_DEFAULT_CENTER}
      defaultZoom={MAP_DEFAULT_ZOOM}
      gestureHandling="greedy"
      disableDefaultUI={false}
      colorScheme={theme === 'dark' ? 'DARK' : 'LIGHT'}
      className="h-full w-full"
    >
      {regionsWithCenter.map((region) => {
        const style = getStatusPalette(region.status);
        const selected = selectedRegionId === region.id;
        const active = selected || hoveredRegionId === region.id;
        const label = t(getRegionTitleKey(region.id));
        const statusLabel = t(`common:status.${region.status}`, {
          defaultValue: region.status,
        });

        return (
          <AdvancedMarker
            key={region.id}
            position={region.center}
            title={label}
            zIndex={active ? 1 : undefined}
            onClick={() => toggleSelectedRegion(region.id)}
            onMouseEnter={() => setHoveredRegionId(region.id)}
            onMouseLeave={() =>
              setHoveredRegionId((current) =>
                current === region.id ? null : current,
              )
            }
          >
            <div
              role="button"
              tabIndex={0}
              aria-expanded={selected}
              className={cn(
                'group/map-marker relative flex cursor-pointer items-center rounded-lg border bg-background/95 p-1.5 text-foreground shadow-lg backdrop-blur-sm transition-all duration-200 outline-none',
                'focus-visible:ring-ring/50 focus-visible:ring-3',
                active && 'scale-105 shadow-xl',
              )}
              style={{ borderColor: active ? style.strokeColor : undefined }}
              onKeyDown={(event) => handleMarkerKeyDown(event, region.id)}
            >
              <div className="relative flex shrink-0 flex-col items-center">
                <span
                  className="block max-w-24 truncate rounded-md px-3 py-2 text-sm leading-none font-semibold whitespace-nowrap text-white shadow-sm"
                  style={{ backgroundColor: style.fillColor }}
                >
                  {label}
                </span>
                <span
                  className="size-0 border-x-[7px] border-t-[7px] border-x-transparent"
                  style={{ borderTopColor: style.fillColor }}
                />
              </div>

              <div
                className={cn(
                  'grid overflow-hidden transition-all duration-200',
                  selected ? 'ml-2 w-56 opacity-100' : 'w-0 opacity-0',
                )}
              >
                <div className="min-w-0 space-y-2 pr-1">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {label}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-[11px] uppercase">
                      {statusLabel}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                    <StatusCount
                      label="Normal"
                      value={region.statusSummary.normal}
                    />
                    <StatusCount
                      label="Warning"
                      value={region.statusSummary.warning}
                    />
                    <StatusCount
                      label="Critical"
                      value={region.statusSummary.critical}
                    />
                  </div>

                  <button
                    type="button"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-7 w-full cursor-pointer items-center justify-center rounded-md px-2 text-xs font-medium transition-colors"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleNavigate(region);
                    }}
                  >
                    Open
                  </button>
                </div>
              </div>
            </div>
          </AdvancedMarker>
        );
      })}
    </Map>
  );
}

function hasRegionCenter(region: Region): region is RegionMarkerData {
  return Boolean(region.center);
}

interface StatusCountProps {
  label: string;
  value: number;
}

function StatusCount({ label, value }: StatusCountProps) {
  return (
    <div className="bg-muted/70 rounded px-1.5 py-1">
      <div className="text-foreground leading-none font-semibold">{value}</div>
      <div className="text-muted-foreground mt-0.5 truncate">{label}</div>
    </div>
  );
}
