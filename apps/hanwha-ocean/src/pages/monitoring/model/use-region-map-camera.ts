import { useCallback } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import type { Site } from '@crane/domain/region';
import {
  WORLD_VIEW_CENTER,
  WORLD_VIEW_ZOOM,
} from './region-map-constants';

export interface RegionMapCamera {
  jumpToSite: (site: Site) => void;
  jumpToWorld: () => void;
}

export function useRegionMapCamera(): RegionMapCamera {
  const map = useMap();

  const jumpToSite = useCallback(
    (site: Site) => {
      if (!map) return;
      map.moveCamera({ center: site.center, zoom: site.defaultRegionZoom });
    },
    [map],
  );

  const jumpToWorld = useCallback(() => {
    if (!map) return;
    map.moveCamera({ center: WORLD_VIEW_CENTER, zoom: WORLD_VIEW_ZOOM });
  }, [map]);

  return { jumpToSite, jumpToWorld };
}
