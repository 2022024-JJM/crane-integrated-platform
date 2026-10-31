import type { YardView } from '../../yard-map'

/** 방위를 -180~180 으로 — 코드 상수(`MAP_BEARING = -48`)와 같은 표기 */
function signedBearing(bearing: number): number {
  const b = ((((bearing + 180) % 360) + 360) % 360) - 180
  return Math.round(b * 10) / 10
}

/** 표시·복사할 값 — 기울기·회전은 소수 첫째, 줌은 정수, 위치는 소수 여섯째 자리 */
export function cameraValuesOf(view: YardView) {
  return {
    pitch: Math.round(view.pitch * 10) / 10,
    bearing: signedBearing(view.bearing),
    scale: Math.round(view.scale),
    centerLat: Math.round(view.centerLat * 1e6) / 1e6,
    centerLon: Math.round(view.centerLon * 1e6) / 1e6,
  }
}
