/**
 * 위경도 ↔ 화면 좌표 투영 — `shared/features/yard-map` 이 소유한다.
 * 야드 모듈 안의 기존 참조를 그대로 두기 위해 다시 내보낸다(re-export).
 */
export {
  LON_SQUEEZE,
  MAX_PITCH,
  TILTED_PITCH,
  MIN_TILTED_PITCH,
  MIN_SCALE,
  MAX_SCALE,
  clampPitch,
  clampScale,
  wrapBearing,
  project,
  worldToScreen,
  screenToWorld,
  metersPer100px,
  fitView,
  zoomAt,
  panBy,
  visibleBounds,
  intersects,
  containsPoint,
  type YardView,
  type YardViewMode,
  type Viewport,
  type ScreenPoint,
  type ProjectedPoint,
} from '../../../shared/features/yard-map/lib/projection'
