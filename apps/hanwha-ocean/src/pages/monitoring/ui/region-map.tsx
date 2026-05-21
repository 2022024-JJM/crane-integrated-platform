import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
  WORLD_VIEW_BOUNDS,
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevLevelRef = useRef<MapLevel | null>(null);

  const sites = useMemo(() => getSites(), []);
  const regionsWithCenter = useMemo<RegionWithCenter[]>(
    () => sites.flatMap((site) => site.regions.filter(hasRegionCenter)),
    [sites],
  );

  const [level, setLevel] = useState<MapLevel>('world');
  const [activeSiteId, setActiveSiteId] = useState<SiteType | null>(null);
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
          // 사용자가 직접 줌인한 위치를 존중하기 위해 카메라는 건드리지 않는다.
        }
      } else if (level === 'site' && zoom <= SITE_EXIT_ZOOM) {
        setLevel('world');
        setActiveSiteId(null);
      }
    };

    const listener = map.addListener('idle', handler);
    return () => listener.remove();
  }, [map, level, sites]);

  const handleEnterSite = useCallback(
    (site: Site) => {
      setLevel('site');
      setActiveSiteId(site.id);
      camera.jumpToSite(site);
    },
    [camera],
  );

  const handleReturnToWorld = useCallback(() => {
    setLevel('world');
    setActiveSiteId(null);
    camera.fitWorld(sites);
  }, [camera, sites]);

  // World로 transition할 때만 1회 fit. 사용자가 World 안에서 드래그/줌으로
  // 카메라를 옮긴 경우에는 그 위치를 그대로 존중해야 하므로, 부모의 1Hz
  // 리렌더(useUtcClock)로 effect가 재실행되더라도 transition이 아니면 skip.
  useEffect(() => {
    if (!map) return;
    if (prevLevelRef.current !== 'world' && level === 'world') {
      camera.fitWorld(sites);
    }
    prevLevelRef.current = level;
  }, [map, level, camera, sites]);

  // 컨테이너 리사이즈(사이드바 토글 등) 시 fit. World 레벨에서만 동작.
  useEffect(() => {
    if (!map) return;
    if (level !== 'world') return;
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      camera.fitWorld(sites);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [map, level, camera, sites]);

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
    <div ref={containerRef} className="relative h-full w-full">
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
        latLngBounds: WORLD_VIEW_BOUNDS,
        strictBounds: false,
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
                hovered={hoveredRegionId === region.id}
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
            'group inline-flex items-center gap-2 rounded-sm',
            'border-border/50 bg-background/55 text-foreground border px-3.5 py-1.5',
            'font-sans text-xs font-semibold tracking-[0.14em] uppercase',
            'backdrop-blur-xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]',
            'hover:bg-foreground/10 cursor-pointer transition-all duration-300',
            isWorldLevel
              ? 'pointer-events-none opacity-0'
              : 'pointer-events-auto opacity-100',
          )}
        >
          <Globe2 className="size-3.5" strokeWidth={1.6} />
          {t('monitoring-overview:map.world.returnToWorld', {
            defaultValue: 'World view',
          })}
        </button>
      </div>
    </Map>
    </div>
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
    <div className="relative">
      {/* Bracket corners (HUD) */}
      <span
        aria-hidden
        className="text-foreground/60 pointer-events-none absolute -top-1 -left-1 size-3 border-t border-l border-current opacity-80"
      />
      <span
        aria-hidden
        className="text-foreground/60 pointer-events-none absolute -top-1 -right-1 size-3 border-t border-r border-current opacity-80"
      />
      <span
        aria-hidden
        className="text-foreground/60 pointer-events-none absolute -bottom-1 -left-1 size-3 border-b border-l border-current opacity-80"
      />
      <span
        aria-hidden
        className="text-foreground/60 pointer-events-none absolute -bottom-1 -right-1 size-3 border-b border-r border-current opacity-80"
      />

      <div
        role="group"
        aria-label={t('monitoring-overview:map.view.toggleAriaLabel', {
          defaultValue: 'Map view',
        })}
        className={cn(
          'pointer-events-auto inline-flex items-center gap-0.5 rounded-sm',
          'border-border/50 bg-background/55 border p-0.5 backdrop-blur-xl',
          'shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_color-mix(in_oklab,var(--foreground)_8%,transparent)]',
        )}
      >
        <ToggleButton
          active={value === 'roadmap'}
          onClick={() => onChange('roadmap')}
          ariaLabel={mapLabel}
        >
          <MapIcon className="size-3" strokeWidth={1.6} />
          <span>{mapLabel}</span>
        </ToggleButton>
        <ToggleButton
          active={value === 'hybrid'}
          onClick={() => onChange('hybrid')}
          ariaLabel={satelliteLabel}
        >
          <Satellite className="size-3" strokeWidth={1.6} />
          <span>{satelliteLabel}</span>
        </ToggleButton>
      </div>
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
        'inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-3 py-1.5 font-sans text-xs font-semibold tracking-[0.12em] uppercase transition-colors',
        active
          ? 'bg-foreground/10 text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
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
        'pointer-events-auto inline-flex items-center gap-2 rounded-sm',
        'border-border/50 bg-background/55 text-foreground border px-3.5 py-1.5',
        'font-sans text-xs font-semibold tracking-[0.14em] uppercase',
        'backdrop-blur-xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]',
      )}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{
          backgroundColor: palette.fillColor,
          boxShadow: `0 0 8px ${palette.fillColor}cc`,
        }}
      />
      <span className="truncate normal-case">{displayName}</span>
      {country ? (
        <span className="text-muted-foreground/80 font-normal">· {country}</span>
      ) : null}
    </div>
  );
}

function hasRegionCenter(region: Region): region is RegionWithCenter {
  return Boolean(region.center);
}
