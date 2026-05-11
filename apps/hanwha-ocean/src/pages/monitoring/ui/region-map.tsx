import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { Globe2 } from 'lucide-react';

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
import { LiveSiteMarker } from './site-marker-live';
import { LiveRegionMarker } from './region-marker-live';

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

type RegionWithCenter = Region & { center: LatLng };
type MapLevel = 'world' | 'site';

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

  return (
    <Map
      mapId={mapId}
      defaultCenter={WORLD_VIEW_CENTER}
      defaultZoom={WORLD_VIEW_ZOOM}
      minZoom={1}
      maxZoom={18}
      gestureHandling="greedy"
      disableDefaultUI={false}
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

      {/* Return to world view */}
      <div
        className={cn(
          'pointer-events-none absolute top-4 right-4 z-40',
          'transition-opacity duration-300',
          isWorldLevel ? 'opacity-0' : 'opacity-100',
        )}
      >
        <button
          type="button"
          onClick={handleReturnToWorld}
          className={cn(
            'pointer-events-auto inline-flex items-center gap-2 rounded-full',
            'border border-white/10 bg-zinc-950/80 px-3.5 py-2 text-xs font-semibold tracking-wide text-white',
            'shadow-lg shadow-black/40 backdrop-blur-md',
            'transition-colors hover:bg-zinc-900/90',
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

function hasRegionCenter(region: Region): region is RegionWithCenter {
  return Boolean(region.center);
}
