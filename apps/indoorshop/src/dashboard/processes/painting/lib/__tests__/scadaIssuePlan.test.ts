import { describe, expect, it } from 'vitest'
import { equipmentOfTypes } from '../../../../shared/entities/equipment'
import { plannedIssueOf } from '../../../../shared/entities/equipment/statusMock'
import { mockEquipmentStatus } from '../equipmentStatusMock'
import type { PaintingEquipment, PaintingEquipmentKind } from '../../model/equipment'

/*
 * 도장 SCADA 도 **같은 명단**을 본다 (R27).
 *
 * 예전에는 이 생성기가 창(30초·90초)마다 제 주사위를 굴려서, 도장 화면은 언제 열어도
 * 통신 오류가 서너 건이었다. 아픈 설비를 고르는 일이 화면마다 따로면 "전체 이상 몇 대"라는
 * 약속이 지켜지지 않는다.
 */

const KIND_OF: Record<string, PaintingEquipmentKind> = { DH: '제습기', GH: '가스히터' }

const SCADA: PaintingEquipment[] = equipmentOfTypes(['DH', 'GH']).map((e) => ({
  id: e.id,
  kind: KIND_OF[e.typeId],
  factory: e.factory,
  bay: e.bay,
  lat: e.lat,
  lon: e.lon,
  x: e.x,
  y: e.y,
}))

const NOW = new Date('2026-09-03T10:00:00').getTime()

describe('도장 SCADA 상태 — 앱 전체 이상 명단을 따른다', () => {
  it('명단에 없는 설비는 통신 OK · 고장 0 이다', () => {
    const healthy = SCADA.filter((e) => plannedIssueOf(e.id) === null)
    expect(healthy.length).toBeGreaterThan(70)
    for (const equipment of healthy) {
      const status = mockEquipmentStatus(equipment, NOW)
      expect(status.modbusLink, equipment.id).toBe('OK')
      expect(status.faultCode, equipment.id).toBe(0)
    }
  })

  it('명단에 든 설비만 통신이 흔들리고, 고장 코드는 오류 등급에만 뜬다', () => {
    const planned = SCADA.filter((e) => plannedIssueOf(e.id) !== null)
    expect(planned.length).toBeGreaterThanOrEqual(1)
    for (const equipment of planned) {
      const status = mockEquipmentStatus(equipment, NOW)
      expect(status.modbusLink).not.toBe('OK')
      const expectFault = plannedIssueOf(equipment.id) === 'error'
      expect(status.faultCode > 0, equipment.id).toBe(expectFault)
    }
  })

  it('시각이 흘러도 이상 대수는 그대로다 — 창마다 새로 아프지 않는다', () => {
    const countAt = (now: number) =>
      SCADA.filter((e) => mockEquipmentStatus(e, now).modbusLink !== 'OK').length
    const first = countAt(NOW)
    expect(countAt(NOW + 45_000)).toBe(first)
    expect(countAt(NOW + 6 * 60_000)).toBe(first)
  })
})
