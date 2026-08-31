import type { LatLonBounds } from '../../features/yard-map'
import { factoryBounds, type YardParcels } from '../../entities/yard-parcels'

/**
 * 대문 카메라 — 대시보드 전체 현황이 처음 열릴 때의 자리.
 *
 * 공장 밀집 구역을 화면 중앙보다 살짝 왼쪽 위에 두고(우측 상태 패널과 겹치지 않게),
 * 음수 패딩으로 범위보다 한 발 **안으로** 들어가 공장 모형이 가깝게 서게 한다.
 * 도장 배치 화면이 같은 값을 써서 두 화면의 초기 지도가 같은 자리에서 시작한다.
 */

/** 대문 카메라 여백 — 음수 = 외곽 공장 한둘이 살짝 잘리더라도 모델이 가깝게 서는 쪽 */
export const OVERVIEW_BOUNDS_PADDING = -0.38

/**
 * 소속 공장이 있는 지번 전체를 감싸는 경계 상자 — 대문 카메라(초기·선택 해제)의 범위.
 * 야드 fixture 의 전체 extent 보다 훨씬 좁아, 여기에 맞추면 공장 부피가 처음부터 선다.
 */
export function allFactoriesBounds(parcels: YardParcels): LatLonBounds | null {
  let minLat = Infinity
  let minLon = Infinity
  let maxLat = -Infinity
  let maxLon = -Infinity
  for (const lot of parcels.lots) {
    if (lot.factory == null) continue
    for (const p of lot.polygon) {
      if (p.lat < minLat) minLat = p.lat
      if (p.lat > maxLat) maxLat = p.lat
      if (p.lon < minLon) minLon = p.lon
      if (p.lon > maxLon) maxLon = p.lon
    }
  }
  if (minLat === Infinity) return null
  return { minLat, minLon, maxLat, maxLon }
}

/** 대문 카메라 범위 — 공장 군집을 살짝 왼쪽 위로 밀어 우측 패널을 피한 자리 */
export function overviewCameraBounds(parcels: YardParcels): LatLonBounds | null {
  const cluster = allFactoriesBounds(parcels)
  if (!cluster) return null
  const latOffset = (cluster.maxLat - cluster.minLat) * -0.08
  const lonOffset = (cluster.maxLon - cluster.minLon) * 0.07
  return {
    minLat: cluster.minLat + latOffset,
    maxLat: cluster.maxLat + latOffset,
    minLon: cluster.minLon + lonOffset,
    maxLon: cluster.maxLon + lonOffset,
  }
}

/**
 * 공장 카메라 범위 — 고른 공장을 가운데 두되, **군집 범위의 일정 비율 위로는 넓히지
 * 않는다.** (`bayCameraBounds` 의 거울상)
 *
 * 공장 지번을 그대로 맞추면 착지 배율이 공장 크기에 그대로 끌려간다. 1DOCK 도장공장은
 * 전처리 A1 부터 B19 까지 670m 비스듬한 띠라 축정렬 범위가 군집 위도폭의 34% 나 되고,
 * 대문 카메라는 이미 음수 여백(`OVERVIEW_BOUNDS_PADDING`)으로 범위 안까지 들어와 있다.
 * 그 둘이 겹쳐 1DOCK 으로 날아가도 배율이 1.3배밖에 오르지 않는다 — 다른 공장이 3~10배로
 * 붙는 것과 달리 "눌러도 확대가 안 된다"로 보인다.
 *
 * 그래서 여백이 아니라 **범위**로 배율의 하한을 만든다: 축마다 군집의 `maxRatio` 까지만
 * 담으므로 어느 공장을 눌러도 비슷한 거리에 착지한다. 긴 공장은 양 끝이 화면 밖으로
 * 나가지만(드래그로 따라간다), 착지 배율이 고른 편이 훑는 감각에 낫다.
 */
export function factoryCameraBounds(
  factory: LatLonBounds,
  cluster: LatLonBounds,
  maxRatio: number
): LatLonBounds {
  const shrink = (min: number, max: number, clusterMin: number, clusterMax: number) => {
    const target = Math.min(max - min, (clusterMax - clusterMin) * maxRatio)
    const center = (min + max) / 2
    return [center - target / 2, center + target / 2] as const
  }
  const [minLat, maxLat] = shrink(factory.minLat, factory.maxLat, cluster.minLat, cluster.maxLat)
  const [minLon, maxLon] = shrink(factory.minLon, factory.maxLon, cluster.minLon, cluster.maxLon)
  return { minLat, maxLat, minLon, maxLon }
}

/**
 * 공장을 골랐을 때 화면에 담을 **군집 범위의 최대 비율** — 확대 배율의 하한이다.
 * 공장 크기가 한 채(≈80m)에서 1DOCK 도장공장의 비스듬한 띠(≈670m)까지 여덟 배 벌어져,
 * 지번 범위를 그대로 맞추면 작은 공장은 10배로 붙고 1DOCK 은 1.3배에 그친다(=확대가 안
 * 된 것처럼 보인다). 범위 쪽을 묶어 어느 공장을 눌러도 2.5배 이상으로 붙게 한다.
 * 값을 올리면 큰 공장이 더 온전히 담기는 대신 착지가 다시 멀어진다.
 */
export const FACTORY_CAMERA_MAX_RATIO = 0.17

/**
 * 이름으로 고른 공장의 카메라 범위 — 지번 범위를 군집 대비로 한 번 조인 값.
 * 지도에 없는 공장이면 `null`.
 *
 * 공장을 누르는 화면(대시보드 전체 현황·선행도장 배치)이 **같은 잣대로 착지**하도록 이
 * 조합을 한자리에 둔다. 화면마다 따로 조합하면 한쪽만 조이는 일이 생긴다 — 실제로 선행도장
 * 배치가 그래서 1DOCK 도장공장을 눌러도 확대가 되지 않았다.
 */
export function factoryCameraBoundsOf(
  parcels: YardParcels,
  factory: string
): LatLonBounds | null {
  const lots = factoryBounds(parcels, factory)
  if (!lots) return null
  const cluster = allFactoriesBounds(parcels)
  return cluster ? factoryCameraBounds(lots, cluster, FACTORY_CAMERA_MAX_RATIO) : lots
}

/**
 * 베이 카메라 범위 — 고른 베이를 가운데 두되, **공장 범위의 일정 비율 아래로는 좁히지
 * 않는다.**
 *
 * 베이 하나에 딱 맞춰 날아가면 배율이 널뛴다: PBS 3BAY 는 지번 한 장(약 100m)이고
 * 1BAY 는 세 장(약 300m)이라, 같은 여백을 줘도 앞의 것은 화면을 꽉 채우고 뒤의 것은
 * 공장 절반이 남는다. 같은 동작(베이 클릭)이 매번 다른 거리로 착지하면 어디를 보고
 * 있는지 감각이 서지 않는다.
 *
 * 그래서 여백이 아니라 **범위**로 배율을 묶는다 — 베이가 아무리 작아도 화면에는 공장의
 * `minRatio` 만큼이 담기므로, 이웃 베이가 늘 함께 남고 확대 배율에 상한이 생긴다.
 */
export function bayCameraBounds(
  bay: LatLonBounds,
  factory: LatLonBounds,
  minRatio: number
): LatLonBounds {
  const grow = (min: number, max: number, factoryMin: number, factoryMax: number) => {
    const target = Math.max(max - min, (factoryMax - factoryMin) * minRatio)
    const center = (min + max) / 2
    return [center - target / 2, center + target / 2] as const
  }
  const [minLat, maxLat] = grow(bay.minLat, bay.maxLat, factory.minLat, factory.maxLat)
  const [minLon, maxLon] = grow(bay.minLon, bay.maxLon, factory.minLon, factory.maxLon)
  return { minLat, maxLat, minLon, maxLon }
}
