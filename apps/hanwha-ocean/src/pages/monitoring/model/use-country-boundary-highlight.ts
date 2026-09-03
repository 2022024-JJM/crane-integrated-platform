import { useEffect, useState } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import type { Site } from '@crane/domain/region';
import { countryBoundaryStyle } from '../lib/country-boundary-style';
import type { BasemapTone } from './region-map-types';

/**
 * 사이트가 있는 나라의 국경선을 지도 위에 따서 "여기에 우리 현장이 있다" 를
 * 한눈에 보이게 한다.
 *
 * 구글맵의 **데이터 기반 스타일링(data-driven styling)** 을 쓴다. 국경 폴리곤은
 * 구글이 벡터 타일로 이미 들고 있으므로, 우리가 GeoJSON 을 싣고 그릴 필요 없이
 * "이 place ID 의 나라만 이렇게 칠해라" 라고 지시하면 된다.
 *
 * **나라의 place ID 는 박아 넣지 않고 좌표에서 역산한다.** 상수로 적어 두면
 * 눈으로 검증할 수 없는 마법의 문자열(`ChIJ...`)이 코드에 남고, 사이트가
 * 늘 때마다 사람이 찾아 넣어야 하며, 틀려도 아무 일도 일어나지 않아 조용히
 * 썩는다. `site.center` 는 이미 있으므로 지오코더에게 "이 좌표는 어느 나라냐"
 * 를 물으면 답이 정확히 하나 나온다. 세션 캐시를 둬서 사이트당 한 번만 묻는다.
 *
 * ## 동작에 필요한 Google Cloud 설정 두 가지
 * 1. Map ID 의 지도 스타일에 **Country feature layer** 활성화
 * 2. API 키에 **Geocoding API** 활성화
 *
 * 둘 중 하나라도 꺼져 있으면 이 훅은 **아무것도 하지 않는다.** 지도는 그대로
 * 정상 동작하고 경계선만 그려지지 않는다 — 지도 전체가 죽는 것보다 낫다.
 */
export function useCountryBoundaryHighlight(
  sites: readonly Site[],
  basemap: BasemapTone,
): void {
  const map = useMap();
  const geocoding = useMapsLibrary('geocoding');
  const [placeIds, setPlaceIds] = useState<readonly string[]>([]);

  // ── 1단계: 사이트 좌표 → 나라 place ID
  useEffect(() => {
    if (!geocoding) return;

    let cancelled = false;
    const geocoder = new geocoding.Geocoder();

    void Promise.all(sites.map((site) => resolveCountryPlaceId(geocoder, site)))
      .then((ids) => {
        if (cancelled) return;
        const found = ids.filter((id): id is string => id !== null);
        // 참조가 매번 바뀌면 아래 스타일 effect 가 헛돈다.
        setPlaceIds((current) => (sameIds(current, found) ? current : found));
      })
      .catch(() => {
        /* 지오코딩이 막혀 있으면 경계선만 포기한다 */
      });

    return () => {
      cancelled = true;
    };
  }, [geocoding, sites]);

  // ── 2단계: 그 place ID 들만 칠한다
  useEffect(() => {
    if (!map || placeIds.length === 0) return;

    const layer = getCountryLayer(map);
    if (!layer) return;

    const style = countryBoundaryStyle(basemap);
    const wanted = new Set(placeIds);

    layer.style = ({ feature }) =>
      wanted.has((feature as google.maps.PlaceFeature).placeId) ? style : null;

    return () => {
      layer.style = null;
    };
  }, [map, placeIds, basemap]);
}

/**
 * Country feature layer 를 꺼내 온다.
 *
 * Cloud Console 에서 켜 두지 않았으면 구글이 콘솔에 에러를 찍고
 * `isAvailable: false` 인 레이어를 돌려준다. 그 레이어에 style 을 걸면
 * 아무 일도 일어나지 않으므로 여기서 걸러 낸다.
 */
function getCountryLayer(
  map: google.maps.Map,
): google.maps.FeatureLayer | null {
  try {
    const layer = map.getFeatureLayer('COUNTRY');
    return layer.isAvailable ? layer : null;
  } catch {
    return null;
  }
}

/** 사이트별 나라 place ID. 한 세션 안에서는 다시 묻지 않는다 (실패도 기억한다) */
const countryPlaceIdCache = new Map<string, string | null>();

async function resolveCountryPlaceId(
  geocoder: google.maps.Geocoder,
  site: Site,
): Promise<string | null> {
  const cached = countryPlaceIdCache.get(site.id);
  if (cached !== undefined) return cached;

  try {
    const { results } = await geocoder.geocode({ location: site.center });
    const country = results.find((result) => result.types.includes('country'));
    const placeId = country?.place_id ?? null;
    countryPlaceIdCache.set(site.id, placeId);
    return placeId;
  } catch {
    countryPlaceIdCache.set(site.id, null);
    return null;
  }
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
