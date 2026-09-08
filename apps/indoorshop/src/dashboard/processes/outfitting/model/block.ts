import type { InshopKey } from '../../../shared/lib/i18n/keys'
import type { Factory } from '../../../shared/entities/factory/model/types'
import { STATUS_STYLE, type StatusMeaning } from '../../../shared/ui/statusPalette'

/**
 * 선행의장 도메인 모델 — **블록 단위**.
 *
 * 의장은 소조/중조/대조 세분이 없다. 정반(BAY)이 아니라 **블록 하나가 작업 단위**이며,
 * 각 블록은 어느 공장의 어느 구역(area)에 놓여 LiDAR 로 관측된다. 실측 파이프라인이
 * 아직 없어 블록 상태·진척은 mock(해시 결정론)이고, 공장/구역 골격만 실 지번 데이터다.
 */

/** 블록 작업 상태 */
export type OutfittingBlockStatus = 'in_progress' | 'completed' | 'waiting'

/**
 * 상태 표현의 단일 출처 — 라벨·색·모양을 한 곳에서만 정한다.
 *
 * 색은 고르지 않고 **의미**만 고른다(상태 팔레트가 색을 준다). 예전에는 작업중이
 * 초록, 완료가 강조색이라 3m 밖에서 **완료 블록이 장애처럼** 읽혔다(감사 O3 — 앱의
 * 다른 곳에서 그 계열은 오류·점검이다). 다 된 것은 초록, 도는 것은 파랑이다.
 */
export const OUTFITTING_STATUS_META: Record<
  OutfittingBlockStatus,
  { labelKey: InshopKey; meaning: StatusMeaning; dot: string; ink: string }
> = {
  in_progress: {
    labelKey: 'outfitting.blockStatus.inProgress',
    meaning: 'inProgress',
    dot: STATUS_STYLE.inProgress.fill,
    ink: STATUS_STYLE.inProgress.ink,
  },
  completed: {
    labelKey: 'outfitting.blockStatus.completed',
    meaning: 'done',
    dot: STATUS_STYLE.done.fill,
    ink: STATUS_STYLE.done.ink,
  },
  waiting: {
    labelKey: 'outfitting.blockStatus.waiting',
    meaning: 'idle',
    dot: STATUS_STYLE.idle.fill,
    ink: STATUS_STYLE.idle.ink,
  },
}

/** 의장 블록 하나 */
export interface OutfittingBlock {
  /** 블록 식별자 (예: 'ofit-pos1-b03') */
  id: string
  factoryId: string
  /** 놓인 구역 코드/이름 */
  areaCode: string
  areaName: string
  /** 호선(공사번호) */
  projNo: string
  /** 블록번호 */
  blkNo: string
  /** 송선기호 (WSTG) — 의장 블록의 계열 */
  wstgCode: string
  status: OutfittingBlockStatus
  /**
   * 조립을 막 끝내고 검사장을 거쳐 **어제 들어온** 블록인가 (로스터 `justArrived`).
   *
   * 상태만으로는 '대기' 인데, 그 대기가 "아직 손도 안 댐" 인지 "어제 막 들어와서 이제부터"
   * 인지가 갈린다 — 뒤엣것은 정상이고 앞엣것은 확인 대상이다. 그 둘을 화면이 가르게 한다.
   */
  justArrived: boolean
  /** 진척률(%) */
  progress: number
  /** 마지막 스캔 시각 (HH:MM) */
  lastScanAt: string
}

/** LiDAR 센서 상태 */
export type OutfittingSensorStatus = 'online' | 'offline' | 'error'

/** 공장의 구역을 관측하는 LiDAR 센서 하나 */
export interface OutfittingSensor {
  id: string
  factoryId: string
  name: string
  /** 담당 구역 이름 */
  areaName: string
  status: OutfittingSensorStatus
  lastScanAt: string
}

/** 공장 카드가 필요로 하는 집계 (블록 중심) */
export interface OutfittingFactoryOverview {
  factory: Factory
  /** 구역 수 */
  areaCount: number
  blockTotal: number
  inProgress: number
  completed: number
  waiting: number
  sensorTotal: number
  sensorOnline: number
  /** offline + error — 손봐야 하는 센서 수 */
  sensorFault: number
  lastScanAt?: string
}
