import { boundsOf, type LatLonBounds } from '../../yard-map'
import type {
  YardParcelFactory,
  YardParcelLot,
  YardParcels,
} from '../../../entities/yard-parcels'

/*
 * 프레임의 순수 계산 — 주인공 공장 판정·타 지번 강등·홈 범위. ProcessMapEntry 에서
 * 떼어 둔 것은 단위 테스트 대상이기 때문이다(캔버스 없이 검증한다).
 */

/** 주인공 공장들 — `factoryNames` 순서가 아니라 parcels 등장 순서. 패널 순서는 prop 이 정한다 */
export function memberFactoriesOf(
  parcels: YardParcels,
  factoryNames: readonly string[]
): YardParcelFactory[] {
  const names = new Set(factoryNames)
  return parcels.factories.filter((f) => names.has(f.name))
}

/**
 * 주인공 밖 지번의 강등 — 소속(공장)과 공정을 지워 무소속 실루엣으로만 남긴다.
 * 무소속 지번은 yard-map 레이어가 옅은 배경으로만 깔고 히트테스트에서도 빼므로,
 * 색도 없고 클릭도 안 된다(그 자리를 누르면 빈 야드 클릭 = 전체 보기 복귀).
 */
export function demoteNonMemberLots(
  parcels: YardParcels,
  members: readonly YardParcelFactory[]
): YardParcelLot[] {
  const names = new Set(members.map((f) => f.name))
  return parcels.lots.map((lot) =>
    lot.factory != null && names.has(lot.factory) ? lot : { ...lot, factory: null, process: '' }
  )
}

/** 주인공 공장들의 공정 집합 — yard-map 스포트라이트(`focusedProcesses`)로 들어간다 */
export function memberProcessesOf(members: readonly YardParcelFactory[]): string[] {
  return [...new Set(members.map((f) => f.process).filter(Boolean))]
}

/** 홈(전체) 범위 — 필터에 걸린 지번 전 정점의 bounds. 하나도 없으면 fallback */
export function memberExtentOf(
  parcels: YardParcels,
  filter: (lot: YardParcelLot) => boolean,
  fallback: LatLonBounds
): LatLonBounds {
  const pts = parcels.lots.filter(filter).flatMap((l) => l.polygon)
  return pts.length > 0 ? boundsOf(pts) : fallback
}

/**
 * 두 bounds 가 값으로 같은가 — 카메라 목표의 정체성 안정화(useStableBounds)의 잣대.
 * YardMap 은 focusBounds 의 **참조**가 바뀔 때만 비행하므로, 같은 값의 새 객체가
 * 시계·폴링 재렌더마다 흘러들면 카메라가 매초 제 프레이밍으로 되돌아 난다(B1 깜빡임).
 */
export function sameBounds(a: LatLonBounds | null, b: LatLonBounds | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.minLat === b.minLat && a.maxLat === b.maxLat && a.minLon === b.minLon && a.maxLon === b.maxLon
  )
}

/** 드릴인한 공장(카드)이 목록 제일 위로 — 전체 보기에서는 원래 순서 그대로 */
export function orderFactoryNames(
  factoryNames: readonly string[],
  selectedFactory: string,
  inOverview: boolean
): readonly string[] {
  if (inOverview || !factoryNames.includes(selectedFactory)) return factoryNames
  return [selectedFactory, ...factoryNames.filter((f) => f !== selectedFactory)]
}
