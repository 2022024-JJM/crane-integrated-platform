import { describe, expect, it } from 'vitest'
import {
  worstSensorStatus,
  sensorStatusCounts,
  bayWorkState,
  bayStage,
} from '../bayStatusSummary'
import type { LidarSensor, LidarSensorStatus } from '../../model/lidarSensor'
import type { LidarBlockInfo } from '../../model/lidarBlock'

function sensor(status: LidarSensorStatus, id: string = status): LidarSensor {
  return { id, locationId: 'bay-1', name: id, status, lastScanAt: '14:00' }
}

function block(wstgCode: string, cadRegistered = true): LidarBlockInfo {
  return {
    id: `blk-${wstgCode}-${Math.random()}`,
    locationId: 'bay-1',
    projNo: '2540',
    blkNo: '281',
    assySerNo: null,
    blockName: 'test',
    wstgCode,
    cadRegistered,
    plan: null,
    confidence: 0.9,
    dimensions: { length: 1, width: 1, height: 1 },
    transform: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] },
    history: [],
  }
}

describe('worstSensorStatus — 대표 상태는 가장 위험한 것 (ERROR > OFFLINE > ONLINE)', () => {
  it('오류가 하나라도 있으면 error', () => {
    expect(worstSensorStatus([sensor('online'), sensor('offline'), sensor('error')])).toBe('error')
  })
  it('오류 없이 오프라인이 있으면 offline', () => {
    expect(worstSensorStatus([sensor('online'), sensor('offline')])).toBe('offline')
  })
  it('전부 정상이면 online', () => {
    expect(worstSensorStatus([sensor('online'), sensor('online')])).toBe('online')
  })
  it('센서가 없으면 null (데이터 미수신)', () => {
    expect(worstSensorStatus([])).toBeNull()
  })
})

describe('sensorStatusCounts — 상태별 대수 축약 요약', () => {
  it('상태별로 정확히 센다', () => {
    const counts = sensorStatusCounts([
      sensor('online', 'a'),
      sensor('online', 'b'),
      sensor('error', 'c'),
      sensor('calibrating', 'd'),
    ])
    expect(counts).toEqual({ online: 2, calibrating: 1, offline: 0, error: 1 })
  })
})

describe('bayWorkState — 작업 없음과 데이터 미수신을 구분한다 (FR-2)', () => {
  it('센서가 없으면 noData', () => {
    expect(bayWorkState([], [])).toBe('noData')
  })
  it('센서는 있고 블록이 없으면 idle (작업 없음)', () => {
    expect(bayWorkState([sensor('online')], [])).toBe('idle')
  })
  it('블록이 있으면 working', () => {
    expect(bayWorkState([sensor('online')], [block('FRAS')])).toBe('working')
  })
})

describe('bayStage — 현공정(송선 앞 2자리) 최빈값', () => {
  it('최빈 현공정을 고른다', () => {
    expect(bayStage([block('FRAS'), block('FRPE'), block('SBAS')])).toBe('FR')
  })
  it('정합 실패 블록은 공정 판정에서 제외한다', () => {
    expect(bayStage([block('FRAS', false), block('SBPE')])).toBe('SB')
  })
  it('판정할 블록이 없으면 null', () => {
    expect(bayStage([])).toBeNull()
    expect(bayStage([block('FRAS', false)])).toBeNull()
  })
})
