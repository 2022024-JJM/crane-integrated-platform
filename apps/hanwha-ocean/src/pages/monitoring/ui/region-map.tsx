import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdvancedMarker, APIProvider, Map } from '@vis.gl/react-google-maps';
import { Anchor, ChevronRight, ChevronUp, X } from 'lucide-react';

import { cn } from '@crane/core/lib/utils';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { useTheme } from '@crane/core/lib/theme-context';
import {
  getRegionSubtitleKey,
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

  const closeSelectedRegion = useCallback(() => {
    setSelectedRegionId(null);
  }, []);

  const selectRegion = useCallback((regionId: string) => {
    setSelectedRegionId(regionId);
  }, []);

  const totalCranes = useCallback(
    (region: RegionMarkerData) =>
      region.statusSummary.normal +
      region.statusSummary.warning +
      region.statusSummary.critical,
    [],
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
        const subtitle = t(getRegionSubtitleKey(region.id));
        const statusLabel = t(`common:status.${region.status}`, {
          defaultValue: region.status,
        });

        return (
          <AdvancedMarker
            key={region.id}
            position={region.center}
            title={label}
            zIndex={selected ? 20 : active ? 10 : undefined}
            onMouseEnter={() => setHoveredRegionId(region.id)}
            onMouseLeave={() =>
              setHoveredRegionId((current) =>
                current === region.id ? null : current,
              )
            }
          >
            <RegionMapMarker
              active={active}
              craneCount={totalCranes(region)}
              label={label}
              onClose={closeSelectedRegion}
              onNavigate={() => handleNavigate(region)}
              onSelect={() => selectRegion(region.id)}
              palette={style}
              selected={selected}
              statusLabel={statusLabel}
              subtitle={subtitle}
            />
          </AdvancedMarker>
        );
      })}
    </Map>
  );
}

function hasRegionCenter(region: Region): region is RegionMarkerData {
  return Boolean(region.center);
}

interface RegionMapMarkerProps {
  active: boolean;
  craneCount: number;
  label: string;
  onClose: () => void;
  onNavigate: () => void;
  onSelect: () => void;
  palette: ReturnType<typeof getStatusPalette>;
  selected: boolean;
  statusLabel: string;
  subtitle: string;
}

function RegionMapMarker({
  active,
  craneCount,
  label,
  onClose,
  onNavigate,
  onSelect,
  palette,
  selected,
  statusLabel,
  subtitle,
}: RegionMapMarkerProps) {
  return (
    <div className="relative flex w-24 flex-col items-center">
      <RegionInfoCard
        craneCount={craneCount}
        label={label}
        onClose={onClose}
        onNavigate={onNavigate}
        palette={palette}
        selected={selected}
        statusLabel={statusLabel}
        subtitle={subtitle}
      />

      <button
        type="button"
        aria-expanded={selected}
        aria-label={label}
        className={cn(
          'group/map-marker relative flex h-28 w-24 cursor-pointer flex-col items-center justify-end pb-1 transition duration-200 outline-none',
          'focus-visible:ring-ring/50 focus-visible:ring-3',
          active && 'scale-105',
        )}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <span className="relative z-10 flex size-14 items-center justify-center transition-transform duration-200 group-hover/map-marker:-translate-y-1">
          <span
            aria-hidden
            className="absolute bottom-1 left-1/2 z-0 size-7 -translate-x-1/2 translate-y-[35%] rotate-45 bg-white"
          />
          <span
            className="relative z-10 flex size-full items-center justify-center rounded-full border-[5px] border-white"
            style={{
              backgroundImage: `linear-gradient(135deg, ${palette.fillColor}, ${palette.fillColorTo})`,
            }}
          >
            <Anchor className="size-7 text-white drop-shadow-sm" />
          </span>
        </span>
      </button>
    </div>
  );
}

interface RegionInfoCardProps {
  craneCount: number;
  label: string;
  onClose: () => void;
  onNavigate: () => void;
  palette: ReturnType<typeof getStatusPalette>;
  selected: boolean;
  statusLabel: string;
  subtitle: string;
}

function RegionInfoCard({
  craneCount,
  label,
  onClose,
  onNavigate,
  palette,
  selected,
  statusLabel,
  subtitle,
}: RegionInfoCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'bg-card/95 text-card-foreground pointer-events-auto absolute bottom-20 left-1/2 z-30 w-80 -translate-x-1/2 rounded-2xl border p-5 shadow-2xl backdrop-blur-md transition duration-200',
        selected
          ? 'translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none translate-y-2 scale-95 opacity-0',
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label={t('monitoring-overview:map.marker.close')}
        className="bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground absolute top-4 right-4 flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-4 pr-8">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-full border-4 border-white text-white shadow-lg"
          style={{
            backgroundImage: `linear-gradient(135deg, ${palette.fillColor}, ${palette.fillColorTo})`,
          }}
        >
          <Anchor className="size-8" />
        </div>

        <div className="min-w-0 pt-1">
          <h2 className="truncate text-xl font-bold tracking-tight">{label}</h2>
          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-6">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="border-border/80 mt-5 border-t pt-4">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-foreground text-lg leading-none font-bold tabular-nums">
              {craneCount}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {t('monitoring-overview:map.marker.craneCount')}
            </div>
          </div>

          <div className="bg-border h-11 w-px" />

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: palette.fillColor }}
            />
            <span className="truncate text-sm font-medium">{statusLabel}</span>
          </div>

          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors"
            aria-label={t('monitoring-overview:map.marker.openDetails')}
            onClick={(event) => {
              event.stopPropagation();
              onNavigate();
            }}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <span className="bg-card border-border absolute bottom-0 left-1/2 size-5 -translate-x-1/2 translate-y-1/2 rotate-45 border-r border-b" />
    </div>
  );
}
