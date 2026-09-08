import { quadContains, type LatLon, type LatLonBounds } from '../model/types'
import { containsPoint, LON_SQUEEZE } from './projection'

/*
 * 발자국 기하 — 점 뭉치에서 "건물 한 채"의 모양을 내는 순수 함수들.
 *
 * 위경도를 그대로 쓰되 경도는 `LON_SQUEEZE`(cos 위도)로 눌러 평면처럼 다룬다. 축 하나를
 * 상수배 누르는 것은 아핀 변환이라 볼록 껍질을 이루는 **꼭짓점 집합이 바뀌지 않고**,
 * 면적·최소사각형 비교도 같은 배율 안에서 이뤄지므로 결론이 흔들리지 않는다.
 */

/**
 * 볼록 껍질 (Andrew monotone chain) — 공장 소속 지번의 점 전체를 감싸는 **건물 발자국**.
 * 3D 에서 공장을 지번 낱장이 아니라 한 동으로 세울 때 쓴다. 지번들이 붙어 있는 painting
 * 데이터 특성상 껍질이 곧 공장 외형에 가깝고, L자 오목부가 메워지는 정도는 모형의
 * 단순화로 받아들인다 — 낱장 격자보다 "공장 한 채"로 읽히는 쪽이 이 화면의 목적이다.
 */
export function convexHull(points: LatLon[]): LatLon[] {
  if (points.length < 3) return points
  const pts = [...points].sort((p, q) => p.lon - q.lon || p.lat - q.lat)
  const cross = (o: LatLon, a: LatLon, b: LatLon) =>
    (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon)
  const lower: LatLon[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop()
    lower.push(p)
  }
  const upper: LatLon[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop()
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

/** 평면 좌표(경도 압축)에서의 폴리곤 면적 — 껍질 vs 사각형 중 무엇이 덜 남는지 잰다 */
export function polygonArea(points: readonly LatLon[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.lon * LON_SQUEEZE * b.lat - b.lon * LON_SQUEEZE * a.lat
  }
  return Math.abs(sum) / 2
}

/**
 * 최소 면적 회전 사각형 (rotating calipers) — 볼록 껍질의 어느 변과 나란한 사각형이
 * 가장 작은지를 찾는다. 공장동은 대부분 직사각형이라, 이 사각형이 껍질의 들쭉날쭉한
 * 모서리보다 "건물 한 채"로 훨씬 잘 읽힌다.
 */
export function minAreaRect(hull: readonly LatLon[]): LatLon[] {
  const pts = hull.map((p) => ({ x: p.lon * LON_SQUEEZE, y: p.lat }))
  let best: { area: number; corners: { x: number; y: number }[] } | null = null
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len === 0) continue
    const ux = (b.x - a.x) / len
    const uy = (b.y - a.y) / len
    let minU = Infinity
    let maxU = -Infinity
    let minV = Infinity
    let maxV = -Infinity
    for (const p of pts) {
      const u = p.x * ux + p.y * uy
      const v = -p.x * uy + p.y * ux
      if (u < minU) minU = u
      if (u > maxU) maxU = u
      if (v < minV) minV = v
      if (v > maxV) maxV = v
    }
    const area = (maxU - minU) * (maxV - minV)
    if (!best || area < best.area) {
      const corner = (u: number, v: number) => ({ x: u * ux - v * uy, y: u * uy + v * ux })
      best = {
        area,
        corners: [
          corner(minU, minV),
          corner(maxU, minV),
          corner(maxU, maxV),
          corner(minU, maxV),
        ],
      }
    }
  }
  if (!best) return [...hull]
  return best.corners.map((c) => ({ lat: c.y, lon: c.x / LON_SQUEEZE }))
}

/**
 * 회색 OSM 건물 링이 **이 공장 도형들과 같은 자리인가** — 무게중심 포함을 양방향으로 본다:
 * 건물 중심이 지번 안에 있거나, 지번 중심이 건물 안에 있으면 같은 자리다.
 *
 * 공장 자리에 우리 공정색 도형과 회색 OSM 건물이 함께 서면 두 모형이 겹쳐 어긋난 것처럼
 * 보이므로, 이 판정에 걸린 링은 회색 층에서 뺀다. 겹침 넓이가 아니라 무게중심으로 보는 것은
 * 의도다 — 지번은 건물 안에 98% 들어 있어(정합 오차 2m ≈ 좌표 반올림) 한 점으로 충분하고,
 * 공장 밖에 걸친 창고가 모서리 하나 겹쳤다고 사라지지도 않는다.
 *
 * `bounds` 는 폴리곤마다 미리 잰 경계 상자다 — 링 수천 개 × 지번 수백 장을 다 곱하지 않도록
 * 값싼 상자 검사로 먼저 거른다.
 */
export function ringSitsOn(
  ring: readonly (readonly [number, number])[],
  shapes: readonly { polygon: LatLon[]; bounds: LatLonBounds }[]
): boolean {
  if (ring.length < 3 || shapes.length === 0) return false
  let lon = 0
  let lat = 0
  for (const [x, y] of ring) {
    lon += x
    lat += y
  }
  const c = { lat: lat / ring.length, lon: lon / ring.length }
  if (
    shapes.some(
      (shape) =>
        containsPoint(shape.bounds, c.lat, c.lon) && quadContains(shape.polygon, c.lat, c.lon)
    )
  ) {
    return true
  }

  /*
   * 반대 방향 — **지번의 중심이 건물 안에** 드는가. 텍사코 T4·T5 처럼 건물 하나가 지번
   * 여러 장(그중 일부는 무소속)을 통째로 품으면 건물 중심이 무소속 지번 위에 떨어져
   * 위 판정을 비껴간다. 공장 지번을 하나라도 품은 건물은 그 공장 자리다.
   */
  const ringPolygon = ring.map(([x, y]) => ({ lat: y, lon: x }))
  const ringBox = boundsOfRing(ring)
  return shapes.some((shape) => {
    let sLat = 0
    let sLon = 0
    for (const p of shape.polygon) {
      sLat += p.lat
      sLon += p.lon
    }
    const sc = { lat: sLat / shape.polygon.length, lon: sLon / shape.polygon.length }
    return containsPoint(ringBox, sc.lat, sc.lon) && quadContains(ringPolygon, sc.lat, sc.lon)
  })
}

/** OSM 링([경도, 위도] 짝)의 경계 상자 */
function boundsOfRing(ring: readonly (readonly [number, number])[]): LatLonBounds {
  let minLat = Infinity
  let minLon = Infinity
  let maxLat = -Infinity
  let maxLon = -Infinity
  for (const [x, y] of ring) {
    if (y < minLat) minLat = y
    if (y > maxLat) maxLat = y
    if (x < minLon) minLon = x
    if (x > maxLon) maxLon = x
  }
  return { minLat, minLon, maxLat, maxLon }
}
