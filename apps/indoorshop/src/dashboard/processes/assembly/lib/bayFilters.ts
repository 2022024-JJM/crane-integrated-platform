import type { LidarSensorStatus } from '../model/lidarSensor'
import type { BayWorkState } from './bayStatusSummary'

/*
 * 공장 뷰 정반 필터 (PRD FR-9) — `이상만 보기` · `미점유 숨기기` · 공정 단계 필터.
 *
 * 필터에 걸린 정반은 **숨기지 않고 가라앉힌다** (FR-5 의 강조 문법과 같은 언어).
 * 공간 문맥을 지운 채 몇 면만 남기면 "어디에 있는가"라는 이 화면의 첫 질문에
 * 답할 수 없기 때문이다. 뷰어는 이 판정을 받아 불투명도만 낮춘다.
 * 프레임워크 비의존 순수 함수 — 단위 테스트 대상.
 */

export interface BayFilter {
  /** 이상(오류·오프라인·데이터 미수신) 정반만 남긴다 */
  abnormalOnly: boolean
  /** 미점유(데이터는 오지만 작업 대상이 없는) 정반을 가라앉힌다 */
  hideUnoccupied: boolean
  /** 이 공정 단계(송선 현공정 코드)의 정반만 남긴다 — null 이면 전체 */
  stage: string | null
}

export const DEFAULT_BAY_FILTER: BayFilter = {
  abnormalOnly: false,
  hideUnoccupied: false,
  stage: null,
}

export function isFilterActive(filter: BayFilter): boolean {
  return filter.abnormalOnly || filter.hideUnoccupied || filter.stage !== null
}

export interface BayFilterInput {
  /** 대표 LiDAR 상태 (worstSensorStatus) — null 은 데이터 미수신 */
  sensorStatus: LidarSensorStatus | null
  workState: BayWorkState
  /** 현재 공정 단계 (bayStage) */
  stage: string | null
}

/** 이상 정반인가 — 오류·오프라인은 물론, 데이터가 아예 안 오는 것도 이상이다 */
export function isAbnormalBay(sensorStatus: LidarSensorStatus | null): boolean {
  return sensorStatus === null || sensorStatus === 'error' || sensorStatus === 'offline'
}

/**
 * 이 정반이 현재 필터를 통과하는가. 모든 조건은 AND 다.
 *
 * `미점유 숨기기`는 idle(데이터는 오지만 작업 없음)만 가라앉힌다 — noData(미수신)는
 * 점유 여부를 모르는 **이상 상태**라 점유 필터로 감추지 않는다 (FR-2: 두 상태 구분).
 */
export function bayPassesFilter(bay: BayFilterInput, filter: BayFilter): boolean {
  if (filter.abnormalOnly && !isAbnormalBay(bay.sensorStatus)) return false
  if (filter.hideUnoccupied && bay.workState === 'idle') return false
  if (filter.stage !== null && bay.stage !== filter.stage) return false
  return true
}
