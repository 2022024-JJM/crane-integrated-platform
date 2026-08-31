import type { InshopKey } from '../../../shared/lib/i18n/keys'
import type { Factory } from '../../../shared/entities/factory/model/types'

/**
 * 선행의장 도메인 모델 — **블록 단위**.
 *
 * 의장은 소조/중조/대조 세분이 없다. 정반(BAY)이 아니라 **블록 하나가 작업 단위**이며,
 * 각 블록은 어느 공장의 어느 구역(area)에 놓여 LiDAR 로 관측된다. 실측 파이프라인이
 * 아직 없어 블록 상태·진척은 mock(해시 결정론)이고, 공장/구역 골격만 실 지번 데이터다.
 */

/** 블록 작업 상태 */
export type OutfittingBlockStatus = 'in_progress' | 'completed' | 'waiting'

/** 상태 표현의 단일 출처 — 라벨·점 색을 한 곳에서만 정한다 */
export const OUTFITTING_STATUS_META: Record<
  OutfittingBlockStatus,
  { labelKey: InshopKey; dot: string; ink: string }
> = {
  in_progress: {
    labelKey: 'outfitting.blockStatus.inProgress',
    dot: 'bg-status-healthy',
    ink: 'text-status-healthy',
  },
  completed: {
    labelKey: 'outfitting.blockStatus.completed',
    dot: 'bg-accent',
    ink: 'text-accent',
  },
  waiting: {
    labelKey: 'outfitting.blockStatus.waiting',
    dot: 'bg-foreground/25',
    ink: 'text-foreground/54',
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
