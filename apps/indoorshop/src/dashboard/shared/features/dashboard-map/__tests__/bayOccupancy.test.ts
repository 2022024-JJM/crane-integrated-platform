import { describe, expect, it } from 'vitest'
import { loadYardParcels } from '../../../entities/yard-parcels'
import { blocksInZone, listBlocks, sitesOfBlock } from '../../../entities/vessel'
import { bayOfPoint, factoryBayOccupancy, bayOccupancyOf } from '../lib/bayOccupancy'

/*
 * 베이 재실 계약 (P1 ①) — 화면이 적는 재실은 **로스터의 자리**와 정확히 같아야 한다.
 * 여기가 깨지면 지도 마커와 상세 목록이 서로 다른 이야기를 한다.
 */
describe('factoryBayOccupancy — 원천은 로스터 sites', () => {
  it('베이 행의 블록은 그 자리에 실제로 선 로스터 블록이다 (자체 생성 금지)', async () => {
    const parcels = await loadYardParcels()
    const rosterKeys = new Set(listBlocks().map((b) => `${b.projNo}-${b.blockNo}`))
    const factories = [...new Set(parcels.bays.map((b) => b.factory))]

    let seen = 0
    for (const factory of factories) {
      for (const row of factoryBayOccupancy(parcels, factory)) {
        for (const occupant of row.occupants) {
          expect(rosterKeys.has(occupant.key)).toBe(true)
          /* 그 블록이 진짜 이 공장에 자리를 갖고 있는가 — 자리 목록으로 되짚는다 */
          const block = listBlocks().find(
            (b) => b.projNo === occupant.projNo && b.blockNo === occupant.blockNo
          )!
          expect(sitesOfBlock(block).some((s) => s.factory === factory)).toBe(true)
          seen += 1
        }
      }
    }
    expect(seen, '재실이 하나도 없다 — 매칭이 통째로 어긋났다').toBeGreaterThan(0)
  })

  it('행 수가 그 공장의 베이 수와 같다 — 빈 베이도 남는다(지도 스팬과 어긋나지 않게)', async () => {
    const parcels = await loadYardParcels()
    let sawEmpty = false
    for (const factory of [...new Set(parcels.bays.map((b) => b.factory))]) {
      const rows = factoryBayOccupancy(parcels, factory)
      expect(rows).toHaveLength(parcels.bays.filter((b) => b.factory === factory).length)
      if (rows.some((r) => r.blockCount === 0)) sawEmpty = true
    }
    expect(sawEmpty, '빈 베이가 하나도 없다 — 빈 칸을 걸러 내고 있다').toBe(true)
  })

  it('세는 값이 목록과 맞는다 — blockCount·assyCount 는 파생일 뿐', async () => {
    const parcels = await loadYardParcels()
    for (const factory of [...new Set(parcels.bays.map((b) => b.factory))]) {
      for (const row of factoryBayOccupancy(parcels, factory)) {
        expect(row.blockCount).toBe(row.occupants.length)
        expect(row.assyCount).toBe(row.occupants.reduce((n, o) => n + o.assys.length, 0))
      }
    }
  })

  it('조립 흩어짐은 ASSY 를 달고 온다 — 자리가 준 것 그대로', async () => {
    const parcels = await loadYardParcels()
    const withAssys = [...new Set(parcels.bays.map((b) => b.factory))]
      .flatMap((f) => factoryBayOccupancy(parcels, f))
      .flatMap((r) => r.occupants)
      .filter((o) => o.assys.length > 0)
    expect(withAssys.length).toBeGreaterThan(0)
  })

  it('bayOccupancyOf 는 공장 목록의 그 행과 같은 값이다', async () => {
    const parcels = await loadYardParcels()
    const row = factoryBayOccupancy(parcels, 'PBS').find((r) => r.blockCount > 0)!
    expect(bayOccupancyOf(parcels, row.bayId)).toEqual(row)
    expect(bayOccupancyOf(parcels, '없는공장#9')).toBeNull()
  })
})

describe('도장 — BTS 좌표를 베이 기하에 떨어뜨린다', () => {
  it('도장 블록은 모두 BTS 좌표를 갖는다 (베이명이 아니라 좌표가 정본)', () => {
    const painting = blocksInZone('painting')
    expect(painting.length).toBeGreaterThan(0)
    for (const block of painting) expect(block.bts, `${block.blockNo}`).toBeDefined()
  })

  it('좌표가 떨어진 베이가 그 블록이 선 베이다 — point-in-bay 로 유도한다', async () => {
    const parcels = await loadYardParcels()
    for (const block of blocksInZone('painting')) {
      const bayId = bayOfPoint(parcels, block.factory, block.bts!)
      expect(bayId, `${block.blockNo} 의 BTS 좌표가 어느 지번에도 안 걸린다`).not.toBeNull()
      /* 재실 목록도 그 베이에 그 블록을 세운다 */
      const row = factoryBayOccupancy(parcels, block.factory).find((r) => r.bayId === bayId)!
      expect(row.occupants.some((o) => o.blockNo === block.blockNo)).toBe(true)
    }
  })

  it('공장 밖 좌표는 null — 없는 칸을 지어내지 않는다', async () => {
    const parcels = await loadYardParcels()
    expect(bayOfPoint(parcels, '1DOCK 도장공장', { lat: 0, lon: 0 })).toBeNull()
  })

  it('베이명은 공장 안에서만 유일하다 — 다른 공장의 좌표는 걸리지 않는다', async () => {
    const parcels = await loadYardParcels()
    const block = blocksInZone('painting')[0]
    expect(bayOfPoint(parcels, '2DOCK 도장공장', block.bts!)).toBeNull()
  })
})
