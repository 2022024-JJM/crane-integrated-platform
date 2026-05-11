import type { LatLng } from '@crane/domain/region';

// 세계지도 전체 뷰. 일반적인 세계지도 관습대로 본초자오선(lng 0) 중심.
export const WORLD_VIEW_CENTER: LatLng = { lat: 15, lng: 0 };
export const WORLD_VIEW_ZOOM = 2;

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
