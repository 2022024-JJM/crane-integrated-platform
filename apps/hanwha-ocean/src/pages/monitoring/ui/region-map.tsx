import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { Globe2, Map as MapIcon, Satellite } from 'lucide-react';

import { cn } from '@crane/core/lib/utils';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { useTheme } from '@crane/core/lib/theme-context';
import {
  getSites,
  type LatLng,
  type Region,
  type Site,
} from '@crane/domain/region';
import type { SiteType } from '@crane/core/lib/site-type-context';
import {
  SITE_ENTER_ZOOM,
  SITE_EXIT_ZOOM,
  SITE_PROXIMITY_KM,
  WORLD_VIEW_CENTER,
  WORLD_VIEW_ZOOM,
} from '../model/region-map-constants';
import { findNearestSite } from '../model/find-nearest-site';
import { useRegionMapCamera } from '../model/use-region-map-camera';
import { useSiteRealtimeStatus } from '../model/use-site-realtime-status';
import { getStatusPalette } from '../model/region-map-types';
import { LiveSiteMarker } from './site-marker-live';
import { LiveRegionMarker } from './region-marker-live';

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

type RegionWithCenter = Region & { center: LatLng };
type MapLevel = 'world' | 'site';
type MapView = 'roadmap' | 'hybrid';

export function RegionMap() {
  const { t } = useTranslation();

  if (!apiKey) {
    return (
      <section
        className={cn(
          'border-border bg-muted/30 relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border p-8 text-center',
        )}
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, color-mix(in oklab, var(--foreground) 6%, transparent), transparent 55%), radial-gradient(circle at 80% 80%, color-mix(in oklab, var(--foreground) 6%, transparent), transparent 55%)',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage:
              'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />
        <div className="relative max-w-md space-y-3">
          <div className="bg-background/80 border-border text-muted-foreground mx-auto flex size-14 items-center justify-center rounded-2xl border shadow-sm backdrop-blur-sm">
            <Globe2 className="size-7" />
          </div>
          <p className="text-foreground text-base font-semibold">
            {t('monitoring-overview:map.missingApiKey.title')}
          </p>
          <p className="text-muted-foreground text-sm">
            {t('monitoring-overview:map.missingApiKey.description')}
          </p>
          <code className="text-muted-foreground bg-muted/60 border-border mt-2 inline-block rounded-md border px-2 py-1 text-xs">
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
  const camera = useRegionMapCamera();
  const map = useMap();

  const sites = useMemo(() => getSites(), []);
  const regionsWithCenter = useMemo<RegionWithCenter[]>(
    () => sites.flatMap((site) => site.regions.filter(hasRegionCenter)),
    [sites],
  );

  const [level, setLevel] = useState<MapLevel>('world');
  const [activeSiteId, setActiveSiteId] = useState<SiteType | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [mapView, setMapView] = useState<MapView>('roadmap');

  // 사용자의 휠/제스처 줌인이 임계값을 넘으면 가장 가까운 site로 자동 진입.
  // 반대로 줌아웃이 EXIT 임계값을 내려가면 자동으로 world로 복귀(하이스테리시스).
  // idle 이벤트는 사용자 조작이 끝났을 때만 발생해 깜빡거림을 막는다.
  useEffect(() => {
    if (!map) return;

    const handler = () => {
      const zoom = map.getZoom();
      const center = map.getCenter();
      if (zoom === undefined || !center) return;

      if (level === 'world' && zoom >= SITE_ENTER_ZOOM) {
        const currentCenter: LatLng = { lat: center.lat(), lng: center.lng() };
        const nearest = findNearestSite(
          currentCenter,
          sites,
          SITE_PROXIMITY_KM,
        );
        if (nearest) {
          setLevel('site');
          setActiveSiteId(nearest.id);
          setSelectedRegionId(null);
          // 사용자가 직접 줌인한 위치를 존중하기 위해 카메라는 건드리지 않는다.
        }
      } else if (level === 'site' && zoom <= SITE_EXIT_ZOOM) {
        setLevel('world');
        setActiveSiteId(null);
        setSelectedRegionId(null);
      }
    };

    const listener = map.addListener('idle', handler);
    return () => listener.remove();
  }, [map, level, sites]);

  const handleEnterSite = useCallback(
    (site: Site) => {
      setLevel('site');
      setActiveSiteId(site.id);
      setSelectedRegionId(null);
      camera.jumpToSite(site);
    },
    [camera],
  );

  const handleReturnToWorld = useCallback(() => {
    setLevel('world');
    setActiveSiteId(null);
    setSelectedRegionId(null);
    camera.jumpToWorld();
  }, [camera]);

  const handleSelectRegion = useCallback((regionId: string) => {
    setSelectedRegionId(regionId);
  }, []);

  const handleCloseRegion = useCallback(() => {
    setSelectedRegionId(null);
  }, []);

  const handleNavigateRegion = useCallback(
    (region: RegionWithCenter) => {
      navigate(region.navigateTo);
    },
    [navigate],
  );

  const isWorldLevel = level === 'world';
  const activeSite = !isWorldLevel && activeSiteId
    ? sites.find((s) => s.id === activeSiteId)
    : null;

  return (
    <Map
      mapId={mapId}
      defaultCenter={WORLD_VIEW_CENTER}
      defaultZoom={WORLD_VIEW_ZOOM}
      minZoom={1}
      maxZoom={18}
      gestureHandling="greedy"
      mapTypeId={mapView}
      disableDefaultUI={true}
      zoomControl={true}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      rotateControl={false}
      scaleControl={false}
      clickableIcons={false}
      colorScheme={theme === 'dark' ? 'DARK' : 'LIGHT'}
      restriction={{
        latLngBounds: {
          north: 85,
          south: -85,
          west: -179.999,
          east: 179.999,
        },
        strictBounds: true,
      }}
      className="h-full w-full"
    >
      {/* World 레벨: Site 마커만 mount */}
      {isWorldLevel
        ? sites.map((site) => (
            <LiveSiteMarker
              key={`site-${site.id}`}
              site={site}
              onEnter={() => handleEnterSite(site)}
            />
          ))
        : null}

      {/* Site 레벨: 활성 사이트의 Region 마커만 mount */}
      {!isWorldLevel
        ? regionsWithCenter
            .filter((region) => region.siteType === activeSiteId)
            .map((region) => (
              <LiveRegionMarker
                key={`region-${region.id}`}
                region={region}
                selected={selectedRegionId === region.id}
                hovered={hoveredRegionId === region.id}
                onSelect={() => handleSelectRegion(region.id)}
                onClose={handleCloseRegion}
                onNavigate={() => handleNavigateRegion(region)}
                onHoverChange={(id) =>
                  setHoveredRegionId((current) =>
                    id === null
                      ? current === region.id
                        ? null
                        : current
                      : id,
                  )
                }
              />
            ))
        : null}

      {/* Top-left floating control: map view toggle */}
      <div className="pointer-events-none absolute top-4 left-4 z-40 flex items-center gap-2">
        <MapViewToggle value={mapView} onChange={setMapView} />
      </div>

      {/* Top-right floating controls: site chip + world view button */}
      <div className="pointer-events-none absolute top-4 right-4 z-40 flex items-center gap-2">
        <div
          className={cn(
            'flex items-center gap-2 transition-opacity duration-300',
            isWorldLevel ? 'opacity-0' : 'opacity-100',
          )}
        >
          {activeSite ? <ActiveSiteChip site={activeSite} /> : null}
        </div>

        <button
          type="button"
          onClick={handleReturnToWorld}
          className={cn(
            'inline-flex items-center gap-2 rounded-full',
            'border-border bg-background/85 text-foreground border px-3.5 py-2 text-xs font-semibold tracking-wide',
            'shadow-lg backdrop-blur-md',
            'hover:bg-accent transition-all duration-300',
            isWorldLevel
              ? 'pointer-events-none opacity-0'
              : 'pointer-events-auto opacity-100',
          )}
        >
          <Globe2 className="size-4" />
          {t('monitoring-overview:map.world.returnToWorld', {
            defaultValue: 'World view',
          })}
        </button>
      </div>
    </Map>
  );
}

function MapViewToggle({
  value,
  onChange,
}: {
  value: MapView;
  onChange: (next: MapView) => void;
}) {
  const { t } = useTranslation();
  const mapLabel = t('monitoring-overview:map.view.map', {
    defaultValue: 'Map',
  });
  const satelliteLabel = t('monitoring-overview:map.view.satellite', {
    defaultValue: 'Satellite',
  });

  return (
    <div
      role="group"
      aria-label={t('monitoring-overview:map.view.toggleAriaLabel', {
        defaultValue: 'Map view',
      })}
      className={cn(
        'pointer-events-auto inline-flex items-center gap-0.5 rounded-full',
        'border-border bg-background/85 border p-0.5 shadow-lg backdrop-blur-md',
      )}
    >
      <ToggleButton
        active={value === 'roadmap'}
        onClick={() => onChange('roadmap')}
        ariaLabel={mapLabel}
      >
        <MapIcon className="size-3.5" />
        <span>{mapLabel}</span>
      </ToggleButton>
      <ToggleButton
        active={value === 'hybrid'}
        onClick={() => onChange('hybrid')}
        ariaLabel={satelliteLabel}
      >
        <Satellite className="size-3.5" />
        <span>{satelliteLabel}</span>
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors',
        active
          ? 'bg-accent text-accent-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
      )}
    >
      {children}
    </button>
  );
}

function ActiveSiteChip({ site }: { site: Site }) {
  const { t } = useTranslation();
  const status = useSiteRealtimeStatus(site);
  const palette = getStatusPalette(status);
  const displayName = t(site.displayNameKey);
  const country = t(site.countryKey, { defaultValue: '' });

  return (
    <div
      className={cn(
        'pointer-events-auto inline-flex items-center gap-2 rounded-full',
        'border-border bg-popover/90 text-popover-foreground border px-3 py-1.5 text-xs font-semibold tracking-wide',
        'shadow-lg backdrop-blur-md',
      )}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{
          backgroundColor: palette.fillColor,
          boxShadow: `0 0 6px ${palette.fillColor}aa`,
        }}
      />
      <span className="truncate">{displayName}</span>
      {country ? (
        <span className="text-muted-foreground font-normal">· {country}</span>
      ) : null}
    </div>
  );
}

function hasRegionCenter(region: Region): region is RegionWithCenter {
  return Boolean(region.center);
}
