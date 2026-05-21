import { useCallback, useMemo } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import type { Site } from '@crane/domain/region';
import {
  computeSitesBounds,
  WORLD_FIT_PADDING_PX,
} from './region-map-constants';

export interface RegionMapCamera {
  jumpToSite: (site: Site) => void;
  fitWorld: (sites: ReadonlyArray<Site>) => void;
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

  // 등록된 모든 site가 한 화면에 들어오도록 동적 bounds로 fit.
  // 종횡비/해상도와 무관하게 결정적으로 동작하도록 wrap-around 없는 박스를 사용.
  const fitWorld = useCallback(
    (sites: ReadonlyArray<Site>) => {
      if (!map) return;
      map.fitBounds(computeSitesBounds(sites), WORLD_FIT_PADDING_PX);
    },
    [map],
  );

  return useMemo(
    () => ({ jumpToSite, fitWorld }),
    [jumpToSite, fitWorld],
  );
}
