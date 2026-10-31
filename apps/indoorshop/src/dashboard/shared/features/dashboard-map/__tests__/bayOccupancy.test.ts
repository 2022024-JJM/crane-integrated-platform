import { describe, expect, it } from 'vitest'
import { colorOfProcess, loadYardParcels } from '../../../entities/yard-parcels'
import { blocksInZone, listBlocks, sitesOfBlock } from '../../../entities/vessel'
import { fabricationOccupantsOf, bayOfPoint, factoryBayOccupancy, bayOccupancyOf, colorOfWork, workSummaryOf } from '../lib/bayOccupancy'
import { assysOfOccupant, bayTabHref, bayViewerHref, viewerHrefOfOccupant } from '../lib/occupantViewer'

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

describe('workSummaryOf — 재실을 작업 종류·수로 접는다', () => {
  const base = { projNo: '2540', blockNo: '281', justArrived: false, path: '/' }

  it('ASSY 자리는 급별로, 블록 단위 자리는 공정별로 세고 정해진 순서로 낸다', () => {
    const works = workSummaryOf([
      { ...base, key: 'a', zone: 'painting', assys: [] },
      { ...base, key: 'b', zone: 'assembly', assys: [{ assyNo: 'S1', tier: 'sub' }, { assyNo: 'G1', tier: 'grand' }] },
      { ...base, key: 'c', zone: 'assembly', assys: [{ assyNo: 'S2', tier: 'sub' }] },
    ])
    /* 소조 → 중조 → 대조 → 블록 단위 공정 */
    expect(works).toEqual([
      { kind: 'sub', count: 2 },
      { kind: 'grand', count: 1 },
      { kind: 'painting', count: 1 },
    ])
  })

  it('재실이 없으면 빈 배열', () => {
    expect(workSummaryOf([])).toEqual([])
  })
})

describe('workSummaryOf — 진행 중만', () => {
  it('갓 반입은 아직 작업 전이라 세지 않는다', () => {
    const base = { projNo: '2540', blockNo: '281', path: '/', zone: 'painting' as const, assys: [] }
    expect(
      workSummaryOf([
        { ...base, key: 'a', justArrived: true },
        { ...base, key: 'b', justArrived: false },
      ])
    ).toEqual([{ kind: 'painting', count: 1 }])
  })
})

describe('colorOfWork — 작업마다 다른 색', () => {
  it('일곱 종류가 모두 서로 다른 색이고, 블록 작업은 그 공정의 색을 따른다', () => {
    const kinds = ['grand', 'mid', 'sub', 'fabrication', 'assembly', 'outfitting', 'painting'] as const
    expect(new Set(kinds.map(colorOfWork)).size).toBe(kinds.length)
    expect(colorOfWork('painting')).toBe(colorOfProcess('도장'))
  })
})

describe('occupantViewer — 베이 카드 작업의 3D 착지', () => {
  it('실제 로스터의 흩어진 ASSY 는 그 정반의 3D 뷰어로, 급 순으로 늘어놓는다', async () => {
    const parcels = await loadYardParcels()
    const row = factoryBayOccupancy(parcels, 'PBS').find((r) => r.occupants.some((o) => o.assys.length > 0))!
    const occupant = row.occupants.find((o) => o.assys.length > 0)!
    const href = viewerHrefOfOccupant(occupant)!
    expect(href).toContain(`block=${occupant.projNo}-${occupant.blockNo}`)
    expect(href).toContain('tab=viewer')
    const tiers = assysOfOccupant(occupant).map((a) => a.tier)
    const rank = { grand: 0, mid: 1, sub: 2 }
    expect(tiers).toEqual([...tiers].sort((a, b) => rank[a] - rank[b]))
  })

  it('도장 블록은 3D 착지가 없다 — 갈 곳 없는 문을 만들지 않는다', () => {
    expect(
      viewerHrefOfOccupant({
        key: '1-1', projNo: '1', blockNo: '1', zone: 'painting', assys: [], justArrived: false, path: '/',
      })
    ).toBeNull()
  })
})

describe('bayViewerHref — 베이 카드 머리의 3D', () => {
  it('조립은 짝지은 정반 상세의 3D 탭 — 블록을 고르지 않는다', () => {
    expect(bayViewerHref([], '/indoorshop/zones/assembly/asm-pbs/asm-pbs-b5')).toBe(
      '/indoorshop/zones/assembly/asm-pbs/asm-pbs-b5?tab=viewer'
    )
  })

  it('의장은 그 베이 블록의 3D 문에서 블록 선택만 뗀다', async () => {
    const parcels = await loadYardParcels()
    const row = factoryBayOccupancy(parcels, 'POS 1공장').find((r) => r.occupants.length > 0)!
    const href = bayViewerHref(row.occupants, null)!
    expect(href).toMatch(/^\/indoorshop\/zones\/outfitting\/ofit-pos1\/ofit-pos1-b\d+\?tab=viewer$/)
  })

  it('3D 가 없는 공정(도장)뿐이면 null', () => {
    expect(
      bayViewerHref(
        [{ key: '1-1', projNo: '1', blockNo: '1', zone: 'painting', assys: [], justArrived: false, path: '/' }],
        null
      )
    ).toBeNull()
  })
})

describe('bayTabHref — 베이 카드 머리의 실적(블록실적 탭)', () => {
  it('조립은 정반 상세의 블록·실적 탭', () => {
    expect(bayTabHref([], '/indoorshop/zones/assembly/asm-pbs/asm-pbs-b5', 'blocks')).toBe(
      '/indoorshop/zones/assembly/asm-pbs/asm-pbs-b5?tab=blocks'
    )
  })

  it('의장은 베이 화면을 블록·실적 탭으로 — 블록 선택·3D 탭은 떼어 낸다', async () => {
    const parcels = await loadYardParcels()
    const row = factoryBayOccupancy(parcels, 'POS 1공장').find((r) => r.occupants.length > 0)!
    const href = bayTabHref(row.occupants, null, 'blocks')!
    expect(href).toMatch(/^\/indoorshop\/zones\/outfitting\/ofit-pos1\/ofit-pos1-b\d+\?tab=blocks$/)
  })
})

describe('fabricationOccupantsOf — 가공 공장은 베이 없이 공장 단위로 센다', () => {
  it('그 공장에서 가공 중인 로스터 블록만, 가공 블록 자리로 낸다', () => {
    const fab = listBlocks().filter((b) => b.zone === 'fabrication')
    expect(fab.length).toBeGreaterThan(0)
    const factory = fab[0].factory
    const occupants = fabricationOccupantsOf(factory)
    expect(occupants.map((o) => o.key).sort()).toEqual(
      fab.filter((b) => b.factory === factory).map((b) => `${b.projNo}-${b.blockNo}`).sort()
    )
    for (const o of occupants) {
      expect(o.zone).toBe('fabrication')
      expect(o.assys).toEqual([])
    }
    expect(fabricationOccupantsOf('없는 공장')).toEqual([])
  })
})
