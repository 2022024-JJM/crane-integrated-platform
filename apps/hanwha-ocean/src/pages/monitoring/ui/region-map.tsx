import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  SITE_ENTER_ZOOM,
  SITE_EXIT_ZOOM,
  SITE_PROXIMITY_KM,
  WORLD_VIEW_BOUNDS,
  WORLD_VIEW_CENTER,
} from '../model/region-map-constants';
import { zoomRatio } from '../lib/zoom-scale';
import { worldFitBounds } from '../lib/world-fit-bounds';
import { findNearestSite } from '../model/find-nearest-site';
import { useRegionMapCamera } from '../model/use-region-map-camera';
import { useMapZoom } from '../model/use-map-zoom';
import { useCountryBoundaryHighlight } from '../model/use-country-boundary-highlight';
import type { BasemapTone } from '../model/region-map-types';
import { LiveSiteMarker } from './site-marker-live';
import { LiveRegionMarker } from './region-marker-live';
import { MapLevelBreadcrumb } from './map-level-breadcrumb';
import { MapViewToggle, type MapView } from './map-view-toggle';
import { MapZoomControl } from './map-zoom-control';

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

type RegionWithCenter = Region & { center: LatLng };
type MapLevel = 'world' | 'site';

export function RegionMap() {
  const { t } = useTranslation();

  if (!apiKey) {
    return (
      <section
        className={cn(
          'border-border bg-muted/30 relative flex flex-1 items-center justify-center overflow-hidden rounded-lg border p-8 text-center',
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
          <div className="bg-background/80 border-border text-muted-foreground mx-auto flex size-14 items-center justify-center rounded-lg border shadow-sm backdrop-blur-sm">
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
    <section className="relative flex flex-1 overflow-hidden rounded-lg border">
      <APIProvider apiKey={apiKey}>
        <RegionMapInner />
      </APIProvider>
    </section>
  );
}

function RegionMapInner() {
  const { theme } = useTheme();
  const navigate = useProgressNavigate();
  const sites = useMemo(() => getSites(), []);

  // 사이트들을 화면 정중앙에 놓는 세계 레벨 프레이밍. 좌표에서 대칭으로 계산한다.
  const worldBounds = useMemo(
    () => worldFitBounds(sites.map((site) => site.center)),
    [sites],
  );
  const camera = useRegionMapCamera(worldBounds);
  const zoom = useMapZoom(MAP_MIN_ZOOM, MAP_MAX_ZOOM);
  const map = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const regionsWithCenter = useMemo<RegionWithCenter[]>(
    () => sites.flatMap((site) => site.regions.filter(hasRegionCenter)),
    [sites],
  );

  const [level, setLevel] = useState<MapLevel>('world');
  const [activeSiteId, setActiveSiteId] = useState<SiteType | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [mapView, setMapView] = useState<MapView>('roadmap');

  // 지도 위에 직접 그리는 도형의 색 기준. 위성(hybrid)은 앱이 라이트여도 늘
  // 어두운 영상이라, 앱 테마만 보면 네 조합(지도/위성 × 라이트/다크) 중
  // 절반에서 대비가 무너진다.
  const basemap: BasemapTone =
    mapView === 'hybrid' || theme === 'dark' ? 'dark' : 'light';

  // 사이트가 있는 나라의 국경선을 따서 "여기" 를 지도 스케일에서 먼저 보여 준다.
  useCountryBoundaryHighlight(sites, basemap);

  // 사용자의 휠/제스처 줌인이 임계값을 넘으면 가장 가까운 site로 자동 진입.
  // 반대로 줌아웃이 EXIT 임계값을 내려가면 자동으로 world로 복귀(하이스테리시스).
  // idle 이벤트는 사용자 조작이 끝났을 때만 발생해 깜빡거림을 막는다.
  useEffect(() => {
    if (!map) return;

    const handler = () => {
      const currentZoom = map.getZoom();
      const center = map.getCenter();
      if (currentZoom === undefined || !center) return;

      if (level === 'world' && currentZoom >= SITE_ENTER_ZOOM) {
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
      } else if (level === 'site' && currentZoom <= SITE_EXIT_ZOOM) {
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
    camera.fitWorld();
  }, [camera]);

  // World 레벨 진입 시 1회 fit, 그리고 컨테이너 리사이즈마다 다시 fit.
  // 화면 종횡비/크기가 달라져도 세계지도 전체가 항상 한 화면에 들어오도록.
  useEffect(() => {
    if (!map) return;
    if (level !== 'world') return;

    camera.fitWorld();

    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      camera.fitWorld();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [map, level, camera]);

  const handleNavigateRegion = useCallback(
    (region: RegionWithCenter) => {
      navigate(region.navigateTo);
    },
    [navigate],
  );

  // 눈금은 슬라이더가 실제로 쓰는 범위(측정된 바닥~최대) 위에 놓여야 한다.
  const siteEnterRatio = zoomRatio(SITE_ENTER_ZOOM, zoom.min, zoom.max);

  const isWorldLevel = level === 'world';
  const activeSite =
    (!isWorldLevel && activeSiteId
      ? sites.find((s) => s.id === activeSiteId)
      : null) ?? null;

  /**
   * 원위치 — 지금 레벨의 기본 화면으로 되돌린다.
   * 사이트 안이면 세계로 나가 버리는 대신 그 사이트의 기본 뷰로 맞춘다.
   * 레벨을 바꾸는 것은 브레드크럼의 일이고, 이 버튼은 카메라만 되돌린다.
   */
  const handleResetView = useCallback(() => {
    if (activeSite) camera.jumpToSite(activeSite);
    else camera.fitWorld();
  }, [camera, activeSite]);

  return (
    // data-map-bounds: 마커 hover 카드가 잘리지 않게 밀어 넣을 기준 영역
    <div ref={containerRef} data-map-bounds className="relative h-full w-full">
      <Map
        mapId={mapId}
        defaultCenter={WORLD_VIEW_CENTER}
        // 첫 프레임부터 최종 프레이밍에 가깝게 — fitWorld 가 곧바로 정밀 보정한다
        defaultBounds={worldBounds}
        minZoom={MAP_MIN_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        gestureHandling="greedy"
        mapTypeId={mapView}
        disableDefaultUI={true}
        // 기본 zoomControl 은 흰 사각형 고정이라 다크/위성 배경에서 혼자 튄다.
        // MapZoomControl 이 같은 오버레이 표면으로 대체한다.
        zoomControl={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        rotateControl={false}
        scaleControl={false}
        clickableIcons={false}
        colorScheme={theme === 'dark' ? 'DARK' : 'LIGHT'}
        restriction={{
          latLngBounds: WORLD_VIEW_BOUNDS,
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
                basemap={basemap}
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
                  basemap={basemap}
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

        {/*
          오버레이는 두 열로 갈라 둔다 — 왼쪽은 읽는 것(지금 어디인가 · 색이
          무슨 뜻인가), 오른쪽은 조작하는 것(무엇을 볼까 · 얼마나 볼까).
          이전에는 토글이 왼쪽, 위치 표시가 오른쪽이라 역할이 뒤섞여 있었다.
        */}
        <div
          className="pointer-events-none absolute top-5 left-5 z-30"
          style={{ animation: 'map-panel-reveal 500ms ease-out both' }}
        >
          <MapLevelBreadcrumb
            site={activeSite}
            onReturnToWorld={handleReturnToWorld}
          />
        </div>

        <div
          className="pointer-events-none absolute top-5 right-5 z-30"
          style={{ animation: 'map-panel-reveal 500ms ease-out 60ms both' }}
        >
          <MapViewToggle value={mapView} onChange={setMapView} />
        </div>

        {/* 구글 저작권 표시가 우하단 끝에 깔리므로 그 위로 띄운다 */}
        <div
          className="pointer-events-none absolute right-5 bottom-9 z-30"
          style={{ animation: 'map-panel-reveal 500ms ease-out 120ms both' }}
        >
          <MapZoomControl
            ratio={zoom.ratio}
            enterThresholdRatio={siteEnterRatio}
            canZoomIn={zoom.canZoomIn}
            canZoomOut={zoom.canZoomOut}
            onZoomIn={zoom.zoomIn}
            onZoomOut={zoom.zoomOut}
            onSeek={zoom.seek}
            onReset={handleResetView}
          />
        </div>
      </Map>
    </div>
  );
}

function hasRegionCenter(region: Region): region is RegionWithCenter {
  return Boolean(region.center);
}
