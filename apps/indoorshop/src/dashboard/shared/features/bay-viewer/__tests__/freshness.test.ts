import { describe, expect, it } from 'vitest'
import type { LidarSensor } from '../model/lidarSensor'
import {
  FRESHNESS_THRESHOLDS,
  elapsedMinutes,
  heartbeatElapsedMinutes,
  isViewDelayed,
  latestScan,
  parseScanTime,
} from '../lib/freshness'

const NOW = new Date(2026, 7, 26, 14, 30, 0)

function sensor(id: string, lastScanAt: string): LidarSensor {
  return { id, locationId: 'bay-1', name: id, status: 'online', lastScanAt }
}

describe('parseScanTime / elapsedMinutes — "HH:MM" 신선도 (FR-1)', () => {
  it('오늘 날짜의 시:분으로 읽는다', () => {
    const at = parseScanTime('13:05', NOW)
    expect(at?.getHours()).toBe(13)
    expect(at?.getMinutes()).toBe(5)
    expect(elapsedMinutes('13:05', NOW)).toBe(85)
  })

  it('읽을 수 없는 값은 추정하지 않고 null', () => {
    expect(parseScanTime('방금', NOW)).toBeNull()
    expect(elapsedMinutes('2026-08-26T14:00:00Z', NOW)).toBeNull()
  })

  it('ISO8601 heartbeat와 값 없음도 처리한다', () => {
    expect(heartbeatElapsedMinutes(new Date(2026, 7, 26, 14, 25).toISOString(), NOW)).toBe(5)
    expect(heartbeatElapsedMinutes(undefined, NOW)).toBeNull()
  })

  it('미래로 찍힌 값(시계 오차·자정 넘김)은 0 분으로 본다', () => {
    expect(elapsedMinutes('23:50', NOW)).toBe(0)
  })
})

describe('latestScan — 가장 신선한 수신 (FR-8 헤더 · FR-9 지연 판정)', () => {
  it('여러 센서 중 경과가 가장 짧은 수신을 고른다', () => {
    const result = latestScan(
      [sensor('s1', '13:00'), sensor('s2', '14:25'), sensor('s3', '12:00')],
      NOW
    )
    expect(result).toEqual({ time: '14:25', minutes: 5 })
  })

  it('읽을 수 없는 값은 건너뛴다 — 전부 못 읽으면 null(미수신)', () => {
    expect(latestScan([sensor('s1', 'bad'), sensor('s2', '14:29')], NOW)).toEqual({
      time: '14:29',
      minutes: 1,
    })
    expect(latestScan([sensor('s1', 'bad')], NOW)).toBeNull()
    expect(latestScan([], NOW)).toBeNull()
  })
})

describe('isViewDelayed — 전체 뷰 데이터 지연 (FR-9)', () => {
  it('가장 신선한 수신이 임계값을 넘으면 지연', () => {
    expect(isViewDelayed({ time: '14:00', minutes: FRESHNESS_THRESHOLDS.viewDelayMinutes })).toBe(
      true
    )
    expect(
      isViewDelayed({ time: '14:25', minutes: FRESHNESS_THRESHOLDS.viewDelayMinutes - 1 })
    ).toBe(false)
  })

  it('수신 이력이 없으면 지연이 아니라 미수신 — false', () => {
    expect(isViewDelayed(null)).toBe(false)
  })
})
