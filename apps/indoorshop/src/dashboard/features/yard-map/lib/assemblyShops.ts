import type { LatLon, LatLonBounds, YardLot } from '../../../entities/yard/model/types'
import { boundsOf, mergeBounds } from '../../../entities/yard/model/types'
import type { LocationStatus } from '../../../entities/location/model/types'
import { findLot } from '../../../entities/yard/api/yardRepository'

/**
 * 감시 대상 조립공장을 야드 도형으로 편다.
 *
 * 야드 맵은 조립 화면을 알지 않는다 — 아래 `Monitored*` 는 "누가 넘겨주든 이만큼만
 * 주면 그린다"는 좁은 계약이고, 실제로 채우는 쪽은 야드 페이지다. 이렇게 갈라 두면
 * 조립 쪽 뷰 모델(FactoryOverview)이 바뀌어도 맵 코드는 그대로다.
 *
 * 지번(구획)은 정반보다 작다 — 정반 하나가 구획 두세 개에 걸치므로, 그리는 단위는
 * **정반이 아니라 지번**이고 정반은 그 지번들의 묶음이다.
 */

/** 조립 화면이 넘겨주는 정반 하나 */
export interface MonitoredBay {
  locationId: string
  name: string
  workCntr: string
  status: LocationStatus
  projNo?: string
  blkNo?: string
  sensorOnline: number
  sensorTotal: number
  todayCount: number
  lastScanAt?: string
  /** 이 정반이 차지하는 야드 지번 코드 */
  yardLots: string[]
}

/** 조립 화면이 넘겨주는 공장 하나 */
export interface MonitoredShop {
  factoryId: string
  name: string
  /** 조립공장 코드 (ASSY_SHOP) */
  assyShop: string
  bays: MonitoredBay[]
}

/** 야드 도형이 붙은 정반 */
export interface YardShopBay extends MonitoredBay {
  factoryId: string
  /** 지번 마스터에서 찾은 실제 구획 — 못 찾은 코드는 빠진다 */
  lots: YardLot[]
  center: LatLon
  bounds: LatLonBounds
}

/** 야드 도형이 붙은 공장 */
export interface YardShop {
  factoryId: string
  name: string
  assyShop: string
  bays: YardShopBay[]
  /** 공장 외곽 — 정반 구획 전체를 감싸는 볼록 껍질 */
  hull: LatLon[]
  center: LatLon
  bounds: LatLonBounds
  /* 아래는 맵 위 라벨이 쓰는 집계 — 화면에서 다시 세지 않도록 여기서 낸다 */
  bayTotal: number
  occupied: number
  sensorOnline: number
  sensorTotal: number
  todayCount: number
}

/**
 * 볼록 껍질 (Andrew's monotone chain).
 *
 * 경도는 위도보다 짧은 거리를 뜻하지만(cos 34.87°) 축 하나를 상수배 누르는 것은
 * 아핀 변환이라 껍질을 이루는 꼭짓점 **집합이 바뀌지 않는다** — 그래서 위경도를
 * 그대로 넣어도 된다.
 */
function convexHull(points: LatLon[]): LatLon[] {
  if (points.length <= 3) return [...points]
  const sorted = [...points].sort((a, b) => a.lon - b.lon || a.lat - b.lat)

  const cross = (o: LatLon, a: LatLon, b: LatLon) =>
    (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon)

  const halfHull = (source: LatLon[]): LatLon[] => {
    const out: LatLon[] = []
    for (const point of source) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 0) {
        out.pop()
      }
      out.push(point)
    }
    return out
  }

  const lower = halfHull(sorted)
  const upper = halfHull([...sorted].reverse())
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/**
 * 껍질을 중심에서 밖으로 조금 밀어낸다.
 *
 * 껍질이 지번 모서리에 딱 붙으면 외곽선과 정반 테두리가 같은 선으로 겹쳐 보여서,
 * "공장"과 "그 안의 정반"이 두 층으로 읽히지 않는다. 공장 크기의 약 3% 만 띄운다.
 */
function inflate(hull: LatLon[], center: LatLon, ratio = 0.03): LatLon[] {
  return hull.map((point) => ({
    lat: center.lat + (point.lat - center.lat) * (1 + ratio),
    lon: center.lon + (point.lon - center.lon) * (1 + ratio),
  }))
}

function centerOf(points: LatLon[]): LatLon {
  let lat = 0
  let lon = 0
  for (const point of points) {
    lat += point.lat
    lon += point.lon
  }
  return { lat: lat / points.length, lon: lon / points.length }
}

/**
 * `MonitoredShop` 목록에 야드 도형을 붙인다.
 *
 * 지번 마스터에 없는 코드와, 구획을 하나도 못 찾은 정반·공장은 조용히 빠진다 —
 * 매핑이 덜 된 상태에서도 화면은 서야 한다 (맵 전체가 빈 화면으로 무너지지 않도록).
 */
export function buildYardShops(shops: MonitoredShop[]): YardShop[] {
  const built: YardShop[] = []

  for (const shop of shops) {
    const bays: YardShopBay[] = []

    for (const bay of shop.bays) {
      const lots = bay.yardLots
        .map((code) => findLot(code))
        .filter((lot): lot is YardLot => lot !== null)
      if (lots.length === 0) continue

      const corners = lots.flatMap((lot) => lot.quad)
      bays.push({
        ...bay,
        factoryId: shop.factoryId,
        lots,
        center: centerOf(corners),
        bounds: lots.map((lot) => lot.bounds).reduce(mergeBounds),
      })
    }

    if (bays.length === 0) continue

    const corners = bays.flatMap((bay) => bay.lots.flatMap((lot) => lot.quad))
    const center = centerOf(corners)
    const hull = inflate(convexHull(corners), center)

    built.push({
      factoryId: shop.factoryId,
      name: shop.name,
      assyShop: shop.assyShop,
      bays,
      hull,
      center,
      bounds: boundsOf(hull),
      bayTotal: bays.length,
      occupied: bays.filter((bay) => bay.status === 'occupied').length,
      sensorOnline: bays.reduce((sum, bay) => sum + bay.sensorOnline, 0),
      sensorTotal: bays.reduce((sum, bay) => sum + bay.sensorTotal, 0),
      todayCount: bays.reduce((sum, bay) => sum + bay.todayCount, 0),
    })
  }

  return built
}

/** 맵·범례·상세가 같은 정반을 같은 말로 부르도록 — 정반 하나를 찾는 단일 경로 */
export function findShopBay(
  shops: YardShop[],
  locationId: string | null | undefined
): { shop: YardShop; bay: YardShopBay } | null {
  if (!locationId) return null
  for (const shop of shops) {
    const bay = shop.bays.find((candidate) => candidate.locationId === locationId)
    if (bay) return { shop, bay }
  }
  return null
}
