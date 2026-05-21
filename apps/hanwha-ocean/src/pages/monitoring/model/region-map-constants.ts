import type { LatLng } from '@crane/domain/region';

// 세계지도 전체 뷰. 일반적인 세계지도 관습대로 본초자오선(lng 0) 중심.
export const WORLD_VIEW_CENTER: LatLng = { lat: 15, lng: 0 };
// fitBounds 실패 시 fallback 용도.
export const WORLD_VIEW_ZOOM = 2;

// restriction.latLngBounds 외곽 한계. fit 자체에는 사용하지 않는다(종횡비별
// wrap-around 모호성으로 사이트가 잘리는 버그가 있었음). 위도만 ±85°로 막아
// 회색 polar 영역 노출을 방지하고, 경도는 전 범위 허용.
export const WORLD_VIEW_BOUNDS = {
  north: 85,
  south: -85,
  west: -180,
  east: 180,
};

// fitBounds 적용 시 마커 hover card와 상단 controls가 잘리지 않도록 픽셀 패딩.
export const WORLD_FIT_PADDING_PX = {
  top: 80,
  right: 80,
  bottom: 80,
  left: 80,
};

// site가 1개뿐일 때 fitBounds가 over-zoom되지 않도록 좌표에 더할 span.
export const SINGLE_SITE_FALLBACK_SPAN_DEG = { lat: 20, lng: 35 };

// 여러 site의 min/max에 추가로 더해 마커가 화면 가장자리에 박히지 않도록.
const MULTI_SITE_MARGIN_DEG = { lat: 10, lng: 10 };

// 등록된 모든 site가 한 화면에 보이도록 동적으로 계산한 fit bounds.
// 사이트 좌표 자체의 min/max로 박스를 만들어 wrap-around 모호성을 제거한다.
export function computeSitesBounds(
  sites: ReadonlyArray<{ center: LatLng }>,
): google.maps.LatLngBoundsLiteral {
  if (sites.length === 0) return WORLD_VIEW_BOUNDS;

  if (sites.length === 1) {
    const { lat, lng } = sites[0].center;
    return {
      north: Math.min(lat + SINGLE_SITE_FALLBACK_SPAN_DEG.lat, 85),
      south: Math.max(lat - SINGLE_SITE_FALLBACK_SPAN_DEG.lat, -85),
      east: Math.min(lng + SINGLE_SITE_FALLBACK_SPAN_DEG.lng, 180),
      west: Math.max(lng - SINGLE_SITE_FALLBACK_SPAN_DEG.lng, -180),
    };
  }

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const { center } of sites) {
    if (center.lat > north) north = center.lat;
    if (center.lat < south) south = center.lat;
    if (center.lng > east) east = center.lng;
    if (center.lng < west) west = center.lng;
  }
  return {
    north: Math.min(north + MULTI_SITE_MARGIN_DEG.lat, 85),
    south: Math.max(south - MULTI_SITE_MARGIN_DEG.lat, -85),
    east: Math.min(east + MULTI_SITE_MARGIN_DEG.lng, 180),
    west: Math.max(west - MULTI_SITE_MARGIN_DEG.lng, -180),
  };
}

// Site 마커 클릭 시 도달할 줌. 기본 region이 잘 보이는 14대 권장.
export const REGION_FOCUS_ZOOM = 14;

// 자동 진입 임계값: 수동 줌인이 이 값 이상이면 가장 가까운 site로 자동 전환.
export const SITE_ENTER_ZOOM = 5;

// 자동 복귀 임계값: 줌이 이 값 이하로 내려가면 world 레벨로 복귀.
// SITE_ENTER_ZOOM과 다르게 둬서(하이스테리시스) 임계값 주변에서 깜빡거림 방지.
export const SITE_EXIT_ZOOM = 3;

// 자동 진입 시 가까운 site로 인정하는 최대 거리 (km).
// 너무 멀면 사용자가 의도한 site가 아닐 수 있으므로 자동 진입을 보류한다.
export const SITE_PROXIMITY_KM = 3000;
