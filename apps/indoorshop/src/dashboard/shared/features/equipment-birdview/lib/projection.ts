import type { LatLon } from '../../../entities/yard-parcels'

/*
 * 버드뷰 투영 — **위경도 → SVG 좌표**.
 *
 * 야드 지도(`features/yard-map`)의 3D 투영을 쓰지 않는다. 저쪽은 기울기·방위·비행을 다루는
 * 카메라이고, 여기서 필요한 것은 "이 공장 하나를 위에서 곧게 내려다본 그림" 하나뿐이다 —
 * 카메라가 없으면 카메라 코드도 필요 없다.
 *
 * 좌표는 이미 EPSG:5187 → WGS84 로 변환돼 fixture 에 실려 있으므로(설비·베이 헐이 같은
 * 프레임) 여기서는 **경도 압축과 회전만** 다룬다. 위도 34.87°에서 경도 1도는 위도 1도보다
 * 짧아서, 그대로 그리면 공장이 가로로 늘어난다.
 *
 * ── 회전을 여기서 거는 이유 (R42) ──
 * 옥포의 공장은 해안선을 따라 20~40° 기울어 앉아 있다. 북쪽을 위로 고정해 그리면 베이가
 * 전부 비스듬한 마름모가 되고, 그 안에 줄을 맞춰도 도면이 아니라 사선 무늬로 읽힌다.
 * 배치도는 **건물 축을 종이 축에 맞춰** 그리는 것이 관례이므로(도면은 늘 똑바로 선다),
 * 투영 단계에서 세계를 한 번 돌려 베이 장변을 가로로 세운다. 회전각은 베이들이 정하고
 * (`lib/orientation`), 이 파일은 그 각을 받아 좌표에만 건다 — 방위를 잃는 대신 칸이
 * 직각으로 서는 쪽을 고른 것이다(사용자 확정).
 */

/** 옥포(위도 ~34.87°)의 경도 압축 — cos(lat). 야드 맵이 쓰는 값과 같은 뜻이다 */
export const LON_SQUEEZE = Math.cos((34.87 * Math.PI) / 180)

/**
 * 화면과 **같은 방향**의 평면 좌표.
 *
 * 경도 압축을 걸고 남북을 뒤집는다(위도는 위로 갈수록 커지고 화면은 아래로 갈수록
 * 커진다). 회전은 이 평면 위에서 돌아야 한다 — 압축 전에 돌리면 각도가 어긋나고,
 * 뒤집기 전에 돌리면 회전 방향이 거울이 된다.
 */
export function planarOf(point: LatLon): { x: number; y: number } {
  return { x: point.lon * LON_SQUEEZE, y: -point.lat }
}

export interface BirdviewProjection {
  /** SVG viewBox 크기 */
  width: number
  height: number
  project: (point: LatLon) => { x: number; y: number }
}

export interface BirdviewProjectionBox {
  width: number
  height: number
  padding?: number
  /** 세계를 돌리는 각(라디안) — 베이 장변이 가로로 서게 하는 값 (R42) */
  rotation?: number
}

/**
 * 점들을 주어진 상자에 **비율을 지키며** 채운다. 그릴 것이 없으면 `null`.
 *
 * 비율을 깨서 채우면 공장이 늘어나고, 늘어난 그림 위의 설비 자리는 실제 자리가 아니다 —
 * 버드뷰의 값은 "저 라이다가 저 베이 안쪽에 있다"는 사실이므로 왜곡하면 뜻이 사라진다.
 * 회전은 비율을 건드리지 않으므로(강체 변환) 그 계약을 깨지 않는다.
 */
export function fitProjection(
  points: readonly LatLon[],
  box: BirdviewProjectionBox
): BirdviewProjection | null {
  if (points.length === 0) return null

  const rotation = box.rotation ?? 0
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  /* 회전은 −θ 방향 — 장변이 θ 로 누워 있으니 그만큼 되돌려야 가로가 된다 */
  const turn = (point: LatLon) => {
    const { x, y } = planarOf(point)
    return { x: x * cos + y * sin, y: -x * sin + y * cos }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const point of points) {
    const { x, y } = turn(point)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }

  const padding = box.padding ?? 8
  const spanX = Math.max(1e-9, maxX - minX)
  const spanY = Math.max(1e-9, maxY - minY)
  const usableW = Math.max(1, box.width - padding * 2)
  const usableH = Math.max(1, box.height - padding * 2)
  const scale = Math.min(usableW / spanX, usableH / spanY)
  /* 남는 쪽은 가운데로 — 그림이 한쪽에 붙지 않게 */
  const offsetX = padding + (usableW - spanX * scale) / 2
  const offsetY = padding + (usableH - spanY * scale) / 2

  return {
    width: box.width,
    height: box.height,
    project: (point) => {
      const { x, y } = turn(point)
      return { x: offsetX + (x - minX) * scale, y: offsetY + (y - minY) * scale }
    },
  }
}

/** 폴리곤을 SVG path 로 — 베이 구획을 그릴 때 */
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
