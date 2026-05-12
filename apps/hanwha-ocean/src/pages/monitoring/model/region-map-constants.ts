import type { LatLng } from '@crane/domain/region';

// 세계지도 전체 뷰. 일반적인 세계지도 관습대로 본초자오선(lng 0) 중심.
export const WORLD_VIEW_CENTER: LatLng = { lat: 15, lng: 0 };
// fitBounds 실패 시 fallback 용도. 평소엔 WORLD_VIEW_BOUNDS로 fit한다.
export const WORLD_VIEW_ZOOM = 2;

// 세계지도 전체를 감싸는 경계. 화면 종횡비와 무관하게 항상 한번에 보이도록
// fitBounds에 사용. Map의 restriction.latLngBounds도 동일 값을 재사용한다.
export const WORLD_VIEW_BOUNDS = {
  north: 85,
  south: -85,
  west: -179.999,
  east: 179.999,
};

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
