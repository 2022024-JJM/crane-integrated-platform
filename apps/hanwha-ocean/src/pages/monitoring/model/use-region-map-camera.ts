import { useCallback, useMemo } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import type { Site } from '@crane/domain/region';
import type { MapBounds } from '../lib/world-fit-bounds';
import { WORLD_FIT_PADDING } from './region-map-constants';

export interface RegionMapCamera {
  jumpToSite: (site: Site) => void;
  fitWorld: () => void;
}

/**
 * @param worldBounds 세계 레벨의 프레이밍. 사이트 좌표에서 계산해 내려받는다
 *   (`worldFitBounds`). 상수로 들고 있지 않는 이유는 그 파일 주석에 있다.
 */
export function useRegionMapCamera(worldBounds: MapBounds): RegionMapCamera {
  const map = useMap();

  const jumpToSite = useCallback(
    (site: Site) => {
      if (!map) return;
      map.moveCamera({ center: site.center, zoom: site.defaultRegionZoom });
    },
    [map],
  );

  // 두 사이트가 오버레이 판에 가리지 않고 균형 있게 들어오도록 맞춘다.
  // 여백을 0 으로 두면 마커가 브레드크럼·판독부 밑에 깔린다.
  const fitWorld = useCallback(() => {
    if (!map) return;
    map.fitBounds(worldBounds, WORLD_FIT_PADDING);
  }, [map, worldBounds]);

  /*
   * 반환 객체를 반드시 메모한다.
   *
   * 매 렌더 새 객체를 돌려주면, 이걸 deps 에 넣은 쪽의 effect 가 렌더마다
   * 다시 돈다. 세계 레벨의 `fitWorld()` effect 가 그랬다 — 줌을 올리면
   * 리렌더가 나고, 리렌더가 effect 를 다시 돌려 곧바로 세계 뷰로 되돌리는
   * 바람에 세계 지도에서 확대·축소가 아예 먹지 않았다.
   */
  return useMemo(() => ({ jumpToSite, fitWorld }), [jumpToSite, fitWorld]);
}
