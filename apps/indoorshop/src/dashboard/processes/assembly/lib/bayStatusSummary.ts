import type { LidarSensor, LidarSensorStatus } from '../model/lidarSensor'
import type { LidarBlockInfo } from '../model/lidarBlock'
import { parseWstgCode } from '../model/lidarBlock'

/*
 * 베이 대표 상태 계산 (PRD FR-2).
 *
 * 뷰어·라벨·탭이 각자 상태를 셈하면 같은 베이를 다르게 말하게 되므로 여기 한 곳에 둔다.
 * 프레임워크·three 비의존 순수 함수 — 단위 테스트 대상.
 */

/**
 * 위험 우선순위 — 값이 작을수록 먼저 알린다.
 * 기준 문서(필드데이터 v0.2)의 `ERROR > OFFLINE > CALIBRATING > ONLINE` 순서 (FR-1).
 */
const STATUS_PRIORITY: Record<LidarSensorStatus, number> = {
  error: 1,
  offline: 2,
  calibrating: 3,
  online: 4,
}

/** 베이 대표 LiDAR 상태 — 가장 위험한 센서 상태. 센서가 없으면 null(데이터 미수신) */
export function worstSensorStatus(sensors: LidarSensor[]): LidarSensorStatus | null {
  let worst: LidarSensorStatus | null = null
  for (const sensor of sensors) {
    if (worst === null || STATUS_PRIORITY[sensor.status] < STATUS_PRIORITY[worst]) {
      worst = sensor.status
    }
  }
  return worst
}

export interface SensorStatusCounts {
  online: number
  calibrating: number
  offline: number
  error: number
}

/** 상태별 대수 — `정상 7 · 보정 1 · 오류 1` 식 축약 요약의 원천 (FR-1) */
export function sensorStatusCounts(sensors: LidarSensor[]): SensorStatusCounts {
  const counts: SensorStatusCounts = { online: 0, calibrating: 0, offline: 0, error: 0 }
  for (const sensor of sensors) counts[sensor.status] += 1
  return counts
}

/**
 * 베이 작업 상태.
 *  - working: 인식된 블록·조립품이 있다
 *  - idle: 데이터는 오지만 작업 대상이 없다 (`작업 없음`)
 *  - noData: 센서 자체가 없거나 상태 데이터가 오지 않는다 (`데이터 미수신`)
 * PRD FR-2 는 `작업 없음`과 `미수신`을 데이터 유무로 구분하라고 못박는다.
 */
export type BayWorkState = 'working' | 'idle' | 'noData'

export function bayWorkState(sensors: LidarSensor[], blocks: LidarBlockInfo[]): BayWorkState {
  if (sensors.length === 0) return 'noData'
  if (blocks.length > 0) return 'working'
  return 'idle'
}

/**
 * 베이의 현재 공정 단계 — 소속 인식 건들의 현공정(송선기호 앞 2자리) 최빈값.
 * 정합 실패(cadRegistered=false) 건은 공정 정보를 신뢰할 수 없어 제외한다.
 * PRD FR-5: 유사 공정 그룹 확정 전에는 `동일 stage 만 유사 대상`으로 처리한다 —
 * 이 값이 그 stage 비교의 키다. 값이 없으면 null(무공정).
 */
export function bayStage(blocks: LidarBlockInfo[]): string | null {
  const counts = new Map<string, number>()
  for (const block of blocks) {
    if (!block.cadRegistered) continue
    const { current } = parseWstgCode(block.wstgCode)
    if (!current) continue
    counts.set(current, (counts.get(current) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [stage, count] of counts) {
    if (count > bestCount) {
      best = stage
      bestCount = count
    }
  }
  return best
}
