/**
 * 야드 맵 — 재사용 가능한 순수 프레젠테이션 지도.
 *
 * 옥포 야드(또는 같은 좌표계의 어떤 배치도)를 캔버스로 그리는 렌더러다. **fixture 를
 * 알지 않는다** — 베이스맵 레이어·전체 범위·지번 색·시설·정반은 전부 props 로 주입받고,
 * 라우팅 규칙은 `*Href` 콜백으로 받는다. 야드 화면·대시보드·설비 화면이 같은 렌더러를
 * 자기 데이터로 재사용한다.
 *
 * 경계: 이 feature 는 `@/processes/**` 를 import 하지 않는다 (shared 는 공정을 모른다).
 */
export {
  YardMap,
  type YardMapProps,
  type YardLayers,
  type YardParcelLayer,
  type YardParcelLayerLot,
  type YardParcelLayerFactory,
  type YardParcelLotGroup,
  type YardParcelBaySpan,
} from './ui/YardMap'

export type {
  LatLon,
  LatLonBounds,
  YardLot,
  YardBlock,
  YardMove,
  YardPlan,
} from './model/types'
export { boundsOf, mergeBounds, quadContains, parseTransportObjectId } from './model/types'

export {
  facilityContains,
  FACILITY_LABEL_MIN_SCALE,
  FACILITY_SMALL_SECTIONS,
  type FacilityProcess,
  type FacilityProcessKey,
  type YardFacility,
} from './model/facility'

export type {
  MonitoredBay,
  MonitoredShop,
  YardShop,
  YardShopBay,
} from './model/shop'

export {
  SEA_COLOR,
  resolveMapTheme,
  type MapTheme,
  type MapThemeSetting,
  type BasemapLayer,
  type BasemapRole,
  type Ring,
} from './lib/basemapStyle'

/*
 * 3D(기울인) 지도 위에 DOM 오버레이를 얹을 때의 기준 높이(m). 마커를 지면(0)에 두면
 * 돋운 공장 지붕 밑으로 들어가므로, 캔버스가 쓰는 것과 같은 높이를 소비자도 쓴다.
 */
export { RELIEF_METERS } from './lib/relief'

export type { YardView, YardViewMode, Viewport, ScreenPoint } from './lib/projection'
/*
 * 위경도 → 화면 좌표 변환. YardMap 위에 DOM 오버레이(배지·라벨·설비 마커 등)를 얹으려는
 * 소비자가 캔버스와 같은 투영을 쓰도록 낸다 — 오버레이가 자기만의 좌표 계산을 들면 지도와 어긋난다.
 */
export { visibleBounds, worldToScreen, project } from './lib/projection'
