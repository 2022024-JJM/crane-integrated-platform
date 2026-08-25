import type { Factory } from '../../../entities/factory/model/types'
import type { LocationStatus } from '../../../entities/location/model/types'

/**
 * 공장 목록 화면이 쓰는 집계 모델.
 *
 * 공장(Factory) 엔티티만으로는 카드를 채울 수 없다 — 정반·라이다·완료 판정을
 * 가로질러 세어야 나오는 값이라, 그 조합을 이 feature 의 뷰 모델로 둔다.
 * 값을 채우는 쪽은 `pages/assembly/api/assemblyApi.ts` 의 `fetchFactoryOverviews`.
 */

/** 공장 카드에 한 줄로 서는 정반 요약 */
export interface FactoryBaySummary {
  locationId: string
  name: string
  workCntr: string
  status: LocationStatus
  projNo?: string
  blkNo?: string
  /** 이 정반의 인식 단위 — 배정된 블록이 없으면 없음 */
  unitLevel?: 'assembly' | 'block'
  sensorTotal: number
  sensorOnline: number
  /** 마지막 스캔 시각 — 그 정반 센서 중 가장 최근 */
  lastScanAt?: string
  /** 오늘 완료 판정된 조립품 수 */
  todayCount: number
  /** 이 정반이 야드에서 차지하는 지번 — 야드 맵이 정반을 그 자리에 그리는 데 쓴다 */
  yardLots?: string[]
}

/** 공장 카드 한 장이 필요로 하는 전부 */
export interface FactoryOverview {
  factory: Factory
  bays: FactoryBaySummary[]
  occupiedCount: number
  emptyCount: number
  unknownCount: number
  sensorTotal: number
  sensorOnline: number
  /** offline + error — 손봐야 하는 센서 수 */
  sensorFault: number
  lastScanAt?: string
  todayCount: number
  /** 이 공장이 다루는 인식 단위 (정반마다 같으면 그 값, 섞여 있으면 'mixed') */
  unitLevel: 'assembly' | 'block' | 'mixed' | 'none'
}
