import type { LatLng } from '@crane/domain/region';

/*
 * 세계 레벨의 초기 프레이밍.
 *
 * 처음에는 경계를 그냥 지구 전체(lng -180~180, lat ±85)로 잡고 본초자오선을
 * 중심에 뒀다. 세계지도 관습대로였지만 이 화면에서는 두 가지가 어긋났다.
 *
 *  1. **우리 사이트는 본초자오선 주변에 없다.** 필라델피아(-75°)와 거제(129°)
 *     둘뿐이고 둘 다 북위 35~40° 다. lng 0 을 중심에 두면 두 사이트가 화면
 *     좌우 끝으로 밀려나고, 가운데의 대서양·아프리카가 화면의 절반을 차지한다.
 *  2. **가로로 긴 화면에서는 위도가 먼저 걸린다.** ±85° 는 메르카토르에서
 *     거의 정사각형이라, 2:1 짜리 화면에 넣으면 세로가 먼저 맞춰지고 남는
 *     가로를 채우려 `strictBounds` 가 줌을 끌어올린다. 그 결과 미국 서부가
 *     화면 왼쪽 밖으로 잘려 나갔다.
 *
 * 그래서 fit 용 경계와 restriction 용 경계를 분리한다. **restriction 은 지구
 * 전체 그대로**(사용자가 어디든 볼 수 있어야 한다), **fit 은 두 사이트를 품는
 * 더 좁은 상자**다. 좁은 상자로 맞추면 줌이 올라가는 방향이라 strictBounds 와
 * 싸우지 않는다.
 *
 * 값은 "두 사이트 + 여유" 로 잡되 세로·가로가 거의 동시에 맞아떨어지도록
 * 골랐다(2:1 화면 기준). 한쪽만 맞으면 반대쪽에 빈 바다가 크게 남는다.
 */
/**
 * fit 여백(px) — 지도 내용이 오버레이 판 아래로 숨지 않게 한다.
 * 위는 브레드크럼·보기 토글, 아래 왼쪽은 판독부, 아래 오른쪽은 줌 컨트롤이
 * 차지한다. 마커 플레이트가 그 밑에 깔리면 이름이 반쯤 가려진 채 남는다.
 *
 * **사방을 같은 값으로 둔다.** 한쪽만 크게 잡으면 fitBounds 가 남는 쪽으로
 * 내용을 밀어서, 사이트를 정중앙에 놓겠다는 계산이 그만큼 어긋난다.
 */
export const WORLD_FIT_PADDING = 88;

/**
 * fit 전 첫 프레임에 쓰는 중심. 두 사이트(필라델피아·거제)의 중간점이라
 * `worldFitBounds()` 가 계산해 내는 중심과 사실상 같다.
 */
export const WORLD_VIEW_CENTER: LatLng = { lat: 37, lng: 27 };
// fitBounds 실패 시 fallback 용도. 평소엔 WORLD_FIT_BOUNDS로 fit한다.
export const WORLD_VIEW_ZOOM = 2;

/**
 * 지도가 허용하는 이동 범위. 지구를 벗어나거나 세로로 무한히 흘러가지 않게만
 * 막고, 프레이밍에는 관여하지 않는다 (그건 위의 `WORLD_FIT_BOUNDS` 일이다).
 */
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

// 지도가 허용하는 줌 범위. Map 컴포넌트의 min/maxZoom 과 커스텀 줌 컨트롤이
// 같은 값을 봐야 트랙 눈금과 버튼 비활성이 실제 한계와 맞는다.
export const MAP_MIN_ZOOM = 1;
export const MAP_MAX_ZOOM = 18;
