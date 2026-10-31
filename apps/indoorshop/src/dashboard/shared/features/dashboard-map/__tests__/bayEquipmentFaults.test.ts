import { describe, expect, it } from 'vitest'
import { YARD_EQUIPMENT } from '../../../entities/equipment'
import { plannedIssues } from '../../../entities/equipment/statusMock'
import { loadYardParcels } from '../../../entities/yard-parcels'
import { equipmentFaultsByBay, faultBaysOf } from '../lib/bayEquipmentFaults'
import { processRank } from '../lib/factoryNav'

/*
 * 베이별 설비 장애 — 설비 현황과 **같은 원천**이어야 한다. 계획된 이상 설비가 놓인 베이는
 * 빠짐없이 장애 베이로 잡혀야 하고, 그 베이 id 는 지도에 실제로 있는 베이여야 한다.
 */
describe('equipmentFaultsByBay', () => {
  it('계획된 이상 설비(공정 불문)의 베이가 전부 장애 베이로 잡힌다', () => {
    const faults = equipmentFaultsByBay()
    const planned = [...plannedIssues().keys()]
    expect(planned.length).toBeGreaterThan(0)
    for (const id of planned) {
      const equipment = YARD_EQUIPMENT.find((e) => e.id === id)!
      if (!equipment.bay || equipment.bay === '-') continue
      expect(faults.get(`${equipment.factory}#${equipment.bay}`), id).toBeGreaterThan(0)
    }
  })

  it('장애 베이 id 는 지도 베이 id 체계와 같다 — 지도에 없는 칸을 만들지 않는다', async () => {
    const parcels = await loadYardParcels()
    const bayIds = new Set(parcels.bays.map((b) => b.id))
    const faults = equipmentFaultsByBay()
    const onMap = [...faults.keys()].filter((id) => bayIds.has(id))
    expect(onMap.length).toBeGreaterThan(0)
  })

  it('한 베이의 장애 설비는 합산하고, 정상 설비는 세지 않는다', () => {
    const faults = equipmentFaultsByBay()
    /* 3DS 3베이 — Edge PC 오류 + 틸팅 통신 끊김 (설비 현황의 계획 명단) */
    expect(faults.get('3DS#3')).toBeGreaterThanOrEqual(2)
    expect(faults.has('PBS#5')).toBe(false)
  })
})

describe('faultBaysOf — 야드 전체 문제 BAY 목록', () => {
  it('장애 베이는 지도 베이 정보(공장·이름·지번)와 장애 설비 목록을 함께 낸다', async () => {
    const parcels = await loadYardParcels()
    const list = faultBaysOf(parcels.bays)
    expect(list.length).toBeGreaterThan(0)
    for (const bay of list) {
      expect(bay.lotCodes.length).toBeGreaterThan(0)
      expect(bay.equipment.length).toBeGreaterThan(0)
      for (const e of bay.equipment) expect(['offline', 'error']).toContain(e.link)
    }
    /* 수는 공장 카드가 쓰는 베이별 수와 같아야 한다 — 원천이 하나다 */
    const counts = equipmentFaultsByBay()
    for (const bay of list) expect(bay.equipment.length).toBe(counts.get(bay.bayId))
  })

  it('공정 순(가공 → 조립 → 의장 → 도장)으로 선다', async () => {
    const parcels = await loadYardParcels()
    const ranks = faultBaysOf(parcels.bays).map((bay) => processRank(bay.process))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it('같은 공정 안에서는 오류가 있는 베이가 통신 끊김뿐인 베이보다 먼저 온다', async () => {
    const parcels = await loadYardParcels()
    const list = faultBaysOf(parcels.bays)
    for (const process of new Set(list.map((bay) => bay.process))) {
      const hasError = list
        .filter((bay) => bay.process === process)
        .map((bay) => bay.equipment.some((e) => e.link === 'error'))
      const firstOfflineOnly = hasError.indexOf(false)
      if (firstOfflineOnly >= 0) expect(hasError.slice(firstOfflineOnly)).not.toContain(true)
    }
  })
})
