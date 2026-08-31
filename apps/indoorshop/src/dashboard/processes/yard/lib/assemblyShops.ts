import type { LatLon, YardLot } from '../model/types'
import { boundsOf, mergeBounds } from '../model/types'
import { findLot } from '../api/yardRepository'
import type {
  MonitoredBay,
  MonitoredShop,
  YardShop,
  YardShopBay,
} from '../../../shared/features/yard-map/model/shop'

/**
 * 감시 대상 조립공장을 야드 도형으로 편다.
 *
 * 타입 계약(`Monitored*`/`YardShop*`)은 `shared/features/yard-map` 이 소유하고, 여기서는
 * 그것을 다시 내보내(re-export) 야드 모듈 안의 기존 참조를 그대로 둔다. 이 파일이 더하는
 * 것은 그 계약을 **옥포 지번 마스터(fixture)와 이어 붙이는** `buildYardShops` 다 — 정반의
 * 지번 코드를 실제 구획(`findLot`)으로 바꾸고 공장 외곽(볼록 껍질)을 낸다.
 *
 * 지번(구획)은 정반보다 작다 — 정반 하나가 구획 두세 개에 걸치므로, 그리는 단위는
 * **정반이 아니라 지번**이고 정반은 그 지번들의 묶음이다.
 */
export type { MonitoredBay, MonitoredShop, YardShop, YardShopBay }

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
