import { boundsOfLots, type LatLonBounds, type YardParcels } from '../../../entities/yard-parcels'
import type { BlockSite } from '../../../entities/vessel'

/**
 * 로스터가 말한 자리(`BlockSite`)를 **지도 위의 점**으로 바꾼다.
 *
 * 로스터는 공장·베이를 **이름**으로 들고 있다(좌표를 두 벌 두지 않으려고 — 지번 폴리곤이
 * 좌표 정본이다). 그 이름을 지번으로 풀어 점과 경계를 여기서 만든다.
 *
 * 해석 순서: **(공장, 베이) → 그 베이의 지번** → 없으면 **공장 전체 지번**. 베이를 못 풀 때
 * 자리를 버리지 않고 공장으로 물러나는 것은, 본체 구역(의장 `POS1-M` 처럼 베이가 없는
 * 자리)도 "그 공장 어딘가"까지는 참말이기 때문이다. 공장조차 못 풀면 그때는 버린다 —
 * 아무 데나 찍느니 안 찍는 편이 낫다.
 */

export interface LocatedSite extends BlockSite {
  lat: number
  lon: number
  /** 이 자리가 덮는 지번 — 지도 글로우(highlightedLot)의 재료 */
  lotCodes: string[]
  /** 베이까지 풀렸나 — false 면 공장 앵커(자리가 공장 수준으로만 알려졌다) */
  bayResolved: boolean
}

const centerOf = (b: LatLonBounds) => ({
  lat: (b.minLat + b.maxLat) / 2,
  lon: (b.minLon + b.maxLon) / 2,
})

/** 자리 하나를 점으로 — 못 풀면 null */
export function locateSite(parcels: YardParcels, site: BlockSite): LocatedSite | null {
  if (site.mapBay) {
    const bay = parcels.bays.find((b) => b.factory === site.factory && b.bay === site.mapBay)
    const bounds = bay && boundsOfLots(parcels, bay.lotCodes)
    if (bay && bounds) {
      return { ...site, ...centerOf(bounds), lotCodes: [...bay.lotCodes], bayResolved: true }
    }
  }
  const factory = parcels.factories.find((f) => f.name === site.factory)
  if (!factory) return null
  const bounds = boundsOfLots(parcels, factory.lotCodes)
  if (!bounds) return null
  return { ...site, ...centerOf(bounds), lotCodes: [...factory.lotCodes], bayResolved: false }
}

/** 자리 목록을 점 목록으로 — 못 푼 자리는 조용히 빠진다(순서는 그대로) */
export function locateSites(parcels: YardParcels, sites: readonly BlockSite[]): LocatedSite[] {
  return sites.map((site) => locateSite(parcels, site)).filter((s): s is LocatedSite => s !== null)
}

/**
 * 자리들을 한 화면에 담는 카메라 상자.
 *
 * 자리가 하나면 그 주변 ~130m 상자(기존 블록 핀과 같은 화각 — 한 점에 카메라를 딱 맞추면
 * 배율이 무한대가 된다). 여럿이면 전부를 감싸되 **최소 크기를 보장한다** — 같은 공장 안의
 * 두 정반처럼 가까운 자리들만 있을 때 카메라가 지나치게 파고들지 않도록.
 */
export function boundsOfSites(sites: readonly LocatedSite[]): LatLonBounds | null {
  if (sites.length === 0) return null
  const MIN_D_LAT = 0.0006
  const MIN_D_LON = 0.0007
  let minLat = Infinity
  let minLon = Infinity
  let maxLat = -Infinity
  let maxLon = -Infinity
  for (const site of sites) {
    if (site.lat < minLat) minLat = site.lat
    if (site.lat > maxLat) maxLat = site.lat
    if (site.lon < minLon) minLon = site.lon
    if (site.lon > maxLon) maxLon = site.lon
  }
  const padLat = Math.max(0, MIN_D_LAT - (maxLat - minLat) / 2)
  const padLon = Math.max(0, MIN_D_LON - (maxLon - minLon) / 2)
  return {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLon: minLon - padLon,
    maxLon: maxLon + padLon,
  }
}
