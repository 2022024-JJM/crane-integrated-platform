import type { LatLon } from '../../../entities/yard-parcels'

/*
 * 버드뷰 투영 — **위경도 → SVG 좌표**.
 *
 * 야드 지도(`features/yard-map`)의 3D 투영을 쓰지 않는다. 저쪽은 기울기·방위·비행을 다루는
 * 카메라이고, 여기서 필요한 것은 "이 공장 하나를 위에서 곧게 내려다본 그림" 하나뿐이다 —
 * 카메라가 없으면 카메라 코드도 필요 없다.
 *
 * 좌표는 이미 EPSG:5187 → WGS84 로 변환돼 fixture 에 실려 있으므로(설비·베이 헐이 같은
 * 프레임) 여기서는 **경도 압축만** 되돌린다. 위도 34.87°에서 경도 1도는 위도 1도보다
 * 짧아서, 그대로 그리면 공장이 가로로 늘어난다.
 */

/** 옥포(위도 ~34.87°)의 경도 압축 — cos(lat). 야드 맵이 쓰는 값과 같은 뜻이다 */
export const LON_SQUEEZE = Math.cos((34.87 * Math.PI) / 180)

export interface BirdviewBounds {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

/** 점들을 감싸는 범위 — 빈 입력이면 null(그릴 것이 없다) */
export function boundsOfPoints(points: readonly LatLon[]): BirdviewBounds | null {
  if (points.length === 0) return null
  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const point of points) {
    minLat = Math.min(minLat, point.lat)
    maxLat = Math.max(maxLat, point.lat)
    minLon = Math.min(minLon, point.lon)
    maxLon = Math.max(maxLon, point.lon)
  }
  return { minLat, maxLat, minLon, maxLon }
}

export interface BirdviewProjection {
  /** SVG viewBox 크기 */
  width: number
  height: number
  project: (point: LatLon) => { x: number; y: number }
}

/**
 * 범위를 주어진 상자에 **비율을 지키며** 채운다.
 *
 * 비율을 깨서 채우면 공장이 늘어나고, 늘어난 그림 위의 설비 자리는 실제 자리가 아니다 —
 * 버드뷰의 값은 "저 라이다가 저 베이 안쪽에 있다"는 사실이므로 왜곡하면 뜻이 사라진다.
 */
export function fitProjection(
  bounds: BirdviewBounds,
  box: { width: number; height: number; padding?: number }
): BirdviewProjection {
  const padding = box.padding ?? 8
  const spanLat = Math.max(1e-9, bounds.maxLat - bounds.minLat)
  const spanLon = Math.max(1e-9, (bounds.maxLon - bounds.minLon) * LON_SQUEEZE)
  const usableW = Math.max(1, box.width - padding * 2)
  const usableH = Math.max(1, box.height - padding * 2)
  const scale = Math.min(usableW / spanLon, usableH / spanLat)
  /* 남는 쪽은 가운데로 — 그림이 한쪽에 붙지 않게 */
  const offsetX = padding + (usableW - spanLon * scale) / 2
  const offsetY = padding + (usableH - spanLat * scale) / 2

  return {
    width: box.width,
    height: box.height,
    project: (point) => ({
      x: offsetX + (point.lon - bounds.minLon) * LON_SQUEEZE * scale,
      /* 위도는 위로 갈수록 커지고 화면은 아래로 갈수록 커진다 — 뒤집는다 */
      y: offsetY + (bounds.maxLat - point.lat) * scale,
    }),
  }
}

/** 폴리곤을 SVG path 로 — 헐(베이 외곽)을 그릴 때 */
export function pathOf(
  polygon: readonly LatLon[],
  projection: BirdviewProjection
): string {
  if (polygon.length < 3) return ''
  return (
    polygon
      .map((point, index) => {
        const { x, y } = projection.project(point)
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ') + ' Z'
  )
}
