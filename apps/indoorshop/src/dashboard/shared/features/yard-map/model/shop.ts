import type { LatLon, LatLonBounds, YardLot } from './types'
import type { LocationStatus } from '../../../entities/location/model/types'

/**
 * 감시 대상 조립공장을 야드 도형으로 편 것의 **타입 계약**.
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
