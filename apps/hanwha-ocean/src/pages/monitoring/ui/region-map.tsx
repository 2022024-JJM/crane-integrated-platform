import { Fragment, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AdvancedMarker,
  APIProvider,
  Map,
  Pin,
} from '@vis.gl/react-google-maps';

import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { useTheme } from '@crane/core/lib/theme-context';
import { getRegionTitleKey, regions, type Region } from '@crane/domain/region';
import {
  getStatusPalette,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
} from '../model/region-map-types';
import { RegionPolygon } from './region-polygon';

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

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

  const regionsWithGeo = useMemo(
    () => regions.filter((region) => region.center || region.polygon),
    [],
  );

  const handleNavigate = useCallback(
    (region: Region) => {
      navigate(region.navigateTo);
    },
    [navigate],
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
      {regionsWithGeo.map((region) => {
        const style = getStatusPalette(region.status);
        const active = hoveredRegionId === region.id;
        const label = t(getRegionTitleKey(region.id));

        return (
          <Fragment key={region.id}>
            {region.polygon && region.polygon.length >= 3 ? (
              <RegionPolygon
                paths={region.polygon}
                style={style}
                active={active}
                onClick={() => handleNavigate(region)}
                onMouseEnter={() => setHoveredRegionId(region.id)}
                onMouseLeave={() =>
                  setHoveredRegionId((current) =>
                    current === region.id ? null : current,
                  )
                }
              />
            ) : null}
            {region.center ? (
              <AdvancedMarker
                position={region.center}
                onClick={() => handleNavigate(region)}
                onMouseEnter={() => setHoveredRegionId(region.id)}
                onMouseLeave={() =>
                  setHoveredRegionId((current) =>
                    current === region.id ? null : current,
                  )
                }
                title={label}
              >
                <div className="flex flex-col items-center gap-1">
                  <Pin
                    background={style.fillColor}
                    borderColor={style.strokeColor}
                    glyphColor="#ffffff"
                    scale={active ? 1.15 : 1}
                  />
                  <span
                    className="rounded border bg-[#1C1C1C] px-2 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap text-white"
                    style={{ borderColor: style.strokeColor }}
                  >
                    {label}
                  </span>
                </div>
              </AdvancedMarker>
            ) : null}
          </Fragment>
        );
      })}
    </Map>
  );
}
