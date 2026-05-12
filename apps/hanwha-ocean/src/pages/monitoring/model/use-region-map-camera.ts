import { useCallback } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import type { Site } from '@crane/domain/region';
import { WORLD_VIEW_BOUNDS } from './region-map-constants';

export interface RegionMapCamera {
  jumpToSite: (site: Site) => void;
  fitWorld: () => void;
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

  // 컨테이너 종횡비에 맞춰 세계지도 전체가 한 화면에 들어오도록 맞춘다.
  const fitWorld = useCallback(() => {
    if (!map) return;
    map.fitBounds(WORLD_VIEW_BOUNDS, 0);
  }, [map]);

  return { jumpToSite, fitWorld };
}
