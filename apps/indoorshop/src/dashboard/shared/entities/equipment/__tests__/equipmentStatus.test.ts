import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT_PANELS,
  YARD_EQUIPMENT,
  equipmentOfPanel,
  equipmentOfTypes,
  isEdgeStale,
  mockEdgePcStatus,
  mockEdgePcStatusById,
  mockPanelStatus,
  mockTiltStatus,
  mockTiltStatusById,
  panelHealthOf,
} from '..'

/**
 * 설비 상태 mock 의 **성질**.
 *
 * 값 자체는 목업이라 특정 숫자를 못 박는 것은 뜻이 없다 — 대신 화면이 기대는 성질을 지킨다:
 * 같은 시각이면 같은 값(결정론), 범위 안의 값, 상태끼리 앞뒤가 맞을 것(링크가 죽은 판의
 * 하트비트가 방금일 수 없다), 그리고 캐비닛 집계가 소속 설비 수와 어긋나지 않을 것.
 */
const NOW = 1_756_000_000_000 // 고정 시각 — 시계를 읽지 않는다

describe('Edge PC 상태 mock', () => {
  const edges = equipmentOfTypes(['EDGE'])

  it('Edge PC 32대 전부에 상태가 나온다', () => {
    expect(edges).toHaveLength(32)
    expect(edges.map((e) => mockEdgePcStatus(e, NOW).id)).toEqual(edges.map((e) => e.id))
  })

  it('같은 시각이면 같은 값 — 화면을 다시 열어도 그림이 흔들리지 않는다', () => {
    const first = edges.map((e) => mockEdgePcStatus(e, NOW))
    const again = edges.map((e) => mockEdgePcStatus(e, NOW))
    expect(again).toEqual(first)
  })

  it('자원 지표는 0~100% 안, 온도는 상식 범위 안', () => {
    for (const e of edges) {
      const s = mockEdgePcStatus(e, NOW)
      for (const v of [s.cpuPercent, s.memoryPercent, s.diskPercent]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
      expect(s.temperatureC).toBeGreaterThan(20)
      expect(s.temperatureC).toBeLessThan(80)
    }
  })

  it('링크가 끊긴 판은 하트비트가 오래됐다 — 상태와 신선도가 어긋나지 않는다', () => {
    for (const e of edges) {
      const s = mockEdgePcStatus(e, NOW)
      if (s.link === 'online') {
        expect(isEdgeStale(s, NOW)).toBe(false)
        expect(s.collector).toBe('running')
      } else {
        expect(isEdgeStale(s, NOW)).toBe(true)
        expect(s.collector).not.toBe('running')
        expect(s.mqttConnected).toBe(false)
      }
    }
  })

  it('시간이 흐르면 자원 지표가 움직인다 — 폴링이 살아 있음을 보여 준다', () => {
    const e = edges[0]
    const later = mockEdgePcStatus(e, NOW + 90_000)
    expect(later.cpuPercent).not.toBe(mockEdgePcStatus(e, NOW).cpuPercent)
  })

  it('ID 조회는 종류를 지킨다 — 라이다에게 Edge PC 상태를 주지 않는다', () => {
    expect(mockEdgePcStatusById(edges[0].id, NOW)?.id).toBe(edges[0].id)
    expect(mockEdgePcStatusById('LD-D01', NOW)).toBeNull()
  })
})

describe('틸팅모듈 상태 mock', () => {
  const tilts = equipmentOfTypes(['TILT'])

  it('틸팅 337대 전부 페어 라이다를 안다', () => {
    expect(tilts).toHaveLength(337)
    for (const t of tilts) {
      const s = mockTiltStatus(t, NOW)
      expect(s.pairedLidarId).toBe(`LD-${t.id.slice(3)}`)
    }
  })

  it('각도는 pan -180~180 · tilt -90~90 안에 든다', () => {
    for (const t of tilts) {
      const s = mockTiltStatus(t, NOW)
      expect(Math.abs(s.panDeg)).toBeLessThanOrEqual(180)
      expect(Math.abs(s.tiltDeg)).toBeLessThanOrEqual(90)
    }
  })

  it('모드와 도달 여부가 앞뒤가 맞는다 — 틸팅중/에러면 목표에 도달해 있지 않다', () => {
    for (const t of tilts) {
      const s = mockTiltStatus(t, NOW)
      if (s.mode === 'idle') {
        expect(s.atTarget).toBe(true)
        expect(s.panDeg).toBe(s.targetPanDeg)
        expect(s.tiltDeg).toBe(s.targetTiltDeg)
        expect(s.motorAlarm).toBe(0)
      } else {
        expect(s.atTarget).toBe(false)
      }
      if (s.mode === 'error') expect(s.motorAlarm).toBeGreaterThan(0)
      else expect(s.motorAlarm).toBe(0)
    }
  })

  it('ID 조회는 종류를 지킨다', () => {
    expect(mockTiltStatusById('PT-D01', NOW)?.pairedLidarId).toBe('LD-D01')
    expect(mockTiltStatusById('LD-D01', NOW)).toBeNull()
  })
})

describe('캐비닛(패널) 상태 mock', () => {
  it('캐비닛 81대 전부 상태가 나오고, 집계가 소속 설비 수와 맞는다', () => {
    expect(EQUIPMENT_PANELS).toHaveLength(81)
    for (const p of EQUIPMENT_PANELS) {
      const s = mockPanelStatus(p, NOW)
      expect(s.memberTotal).toBe(equipmentOfPanel(p.id).length)
      expect(s.memberOnline + s.memberFaulty).toBe(s.memberTotal)
      expect(s.lidarPairs).toBe(p.memberCountByType.LIDAR ?? 0)
    }
  })

  it('전원이나 업링크가 죽은 판은 소속 설비를 전부 이상으로 센다', () => {
    const down = EQUIPMENT_PANELS.map((p) => mockPanelStatus(p, NOW)).filter(
      (s) => !s.powered || s.uplink === 'offline'
    )
    expect(down.length).toBeGreaterThan(0)
    for (const s of down) {
      expect(s.memberFaulty).toBe(s.memberTotal)
      expect(s.health).toBe('down')
    }
  })

  it('판정 규칙 — 전원·업링크가 소속 설비보다 먼저다', () => {
    expect(panelHealthOf({ powered: false, uplink: 'online', memberFaulty: 0 })).toBe('down')
    expect(panelHealthOf({ powered: true, uplink: 'offline', memberFaulty: 0 })).toBe('down')
    expect(panelHealthOf({ powered: true, uplink: 'error', memberFaulty: 0 })).toBe('degraded')
    expect(panelHealthOf({ powered: true, uplink: 'online', memberFaulty: 2 })).toBe('degraded')
    expect(panelHealthOf({ powered: true, uplink: 'online', memberFaulty: 0 })).toBe('healthy')
  })

  it('빈 캐비닛은 집계가 0이고, 그래도 자기 전원·링크는 말한다', () => {
    const empty = EQUIPMENT_PANELS.filter((p) => p.memberIds.length === 0)
    expect(empty).toHaveLength(16)
    for (const p of empty) {
      const s = mockPanelStatus(p, NOW)
      expect(s.memberTotal).toBe(0)
      expect(typeof s.powered).toBe('boolean')
    }
  })

  it('상태 mock 은 실데이터(대수·소속)를 바꾸지 않는다', () => {
    const before = YARD_EQUIPMENT.length
    EQUIPMENT_PANELS.forEach((p) => mockPanelStatus(p, NOW))
    expect(YARD_EQUIPMENT).toHaveLength(before)
  })
})
