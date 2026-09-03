import { describe, expect, it } from 'vitest'
import { loadYardParcels } from '../../yard-parcels'
import {
  blockAtBay,
  blockOptionsOfVessel,
  blocksAtFactory,
  blocksAtOutfittingFactory,
  blocksInZone,
  blocksOfVessel,
  blocksWithCadModel,
  findBlock,
  findVessel,
  listBlocks,
  listVessels,
  zonePathOfBlock,
} from '../lib/roster'
import { sitesOfBlock } from '../lib/sites'

/**
 * 로스터의 계약 — 이 우주가 하나로 남아 있는지. 여기가 깨지면 화면끼리 이어지지 않는다.
 */
describe('호선·블록 로스터 — 단일 우주 불변식', () => {
  it('모든 블록의 호선이 호선 목록에 있다 (고아 블록 금지)', () => {
    const known = new Set(listVessels().map((v) => v.projNo))
    for (const block of listBlocks()) {
      expect(known.has(block.projNo), `${block.projNo}-${block.blockNo}`).toBe(true)
    }
  })

  it('호선 안에서 블록번호가 유일하다', () => {
    for (const vessel of listVessels()) {
      const nos = blocksOfVessel(vessel.projNo).map((b) => b.blockNo)
      expect(new Set(nos).size).toBe(nos.length)
    }
  })

  it('모든 호선에 블록이 하나 이상 있다 (빈 호선은 필터에서 막다른 길이 된다)', () => {
    for (const vessel of listVessels()) {
      expect(blocksOfVessel(vessel.projNo).length, vessel.projNo).toBeGreaterThan(0)
    }
  })

  it('정반은 블록 하나만 받는다 (한 정반에 두 블록이 겹치지 않는다)', () => {
    const bays = listBlocks()
      .map((b) => b.berth?.bayId)
      .filter((id): id is string => Boolean(id))
    expect(new Set(bays).size).toBe(bays.length)
  })

  it('정반 id 는 그 공장 id 로 시작한다 (딥링크 `/zones/assembly/{factoryId}/{bayId}` 계약)', () => {
    for (const block of listBlocks()) {
      if (!block.berth) continue
      expect(block.berth.bayId.startsWith(`${block.berth.factoryId}-b`)).toBe(true)
    }
  })

  it('배치(berth/outfitting)는 그 블록의 공정존과 어긋나지 않는다', () => {
    for (const block of listBlocks()) {
      if (block.berth) expect(block.zone).toBe('assembly')
      if (block.outfitting) expect(block.zone).toBe('outfitting')
    }
  })

  it('CAD 실측 블록 다섯은 그대로다 — public/models 파일명이 곧 키라 바꾸면 형상이 깨진다', () => {
    const keys = blocksWithCadModel()
      .map((b) => `${b.projNo}_${b.blockNo}`)
      .sort()
    expect(keys).toEqual(['2540_281', '2543_642', '2570_153', '4391_154', '4392_133'])
  })

  it('CAD 블록은 전부 정반에 앉아 있다 (형상만 있고 자리가 없는 블록은 없다)', () => {
    for (const block of blocksWithCadModel()) {
      expect(block.berth?.bayId, `${block.projNo}-${block.blockNo}`).toBeTruthy()
    }
  })

  it('정반이 있는 블록의 지도 베이는 그 정반 번호와 같다 (두 값이 어긋나면 마커가 딴 데 선다)', () => {
    for (const block of listBlocks()) {
      if (!block.berth) continue
      expect(block.berth.bayId, `${block.projNo}-${block.blockNo}`).toBe(
        `${block.berth.factoryId}-b${block.mapBay}`
      )
    }
  })

  it('공정존 네 개가 전부 표본을 가진다 — 검색 시나리오가 화면에서 재현 가능해야 한다', () => {
    for (const zone of ['fabrication', 'assembly', 'outfitting', 'painting'] as const) {
      expect(blocksInZone(zone).length, zone).toBeGreaterThan(0)
    }
  })
})

/**
 * 로스터가 적은 공장·베이가 **지도 fixture 에 실재하는지**. 이 검사가 없으면 마커를
 * 못 찍는 자리가 조용히 섞여 들어와, 검색해도 지도에 아무것도 안 뜨는 블록이 생긴다.
 */
describe('로스터 ↔ 야드 지도 fixture', () => {
  it('모든 블록의 공장이 지도 공장 목록에 있다', async () => {
    const parcels = await loadYardParcels()
    const known = new Set(parcels.factories.map((f) => f.name))
    for (const block of listBlocks()) {
      expect(known.has(block.factory), `${block.projNo}-${block.blockNo}: ${block.factory}`).toBe(true)
    }
  })

  it('모든 자리의 (공장, 베이) 조합이 지도 베이로 풀린다', async () => {
    const parcels = await loadYardParcels()
    const bays = new Set(parcels.bays.map((b) => b.id))
    for (const block of listBlocks()) {
      for (const site of sitesOfBlock(block)) {
        if (!site.mapBay) continue
        expect(bays.has(`${site.factory}#${site.mapBay}`), `${block.projNo}-${block.blockNo}: ${site.id}`).toBe(true)
      }
    }
  })

  it('ASSY 소재 공장도 전부 지도 공장이다', async () => {
    const parcels = await loadYardParcels()
    const known = new Set(parcels.factories.map((f) => f.name))
    for (const block of listBlocks()) {
      for (const unit of block.assyUnits ?? []) expect(known.has(unit.factory), unit.assyNo).toBe(true)
    }
  })
})

describe('로스터 조회 — 같은 블록을 어느 쪽에서 찾아도 같은 객체', () => {
  it('정반으로 찾은 블록과 호선으로 찾은 블록이 같다', () => {
    for (const block of blocksWithCadModel()) {
      const byBay = blockAtBay(block.berth!.bayId)
      const byKey = findBlock(block.projNo, block.blockNo)
      expect(byBay).toBe(byKey)
      expect(byBay).toBe(block)
    }
  })

  it('공장 목록과 호선 목록이 같은 블록을 말한다', () => {
    for (const block of listBlocks()) {
      expect(blocksAtFactory(block.factory)).toContain(block)
      expect(blocksOfVessel(block.projNo)).toContain(block)
    }
  })

  it('없는 호선·블록·정반은 null (빈 객체를 지어내지 않는다)', () => {
    expect(findVessel('0000')).toBeNull()
    expect(findBlock('7004', '999')).toBeNull()
    expect(blockAtBay('asm-없는공장-b9')).toBeNull()
    expect(blocksOfVessel('0000')).toEqual([])
    expect(blocksAtFactory('없는공장')).toEqual([])
  })

  it('반환 배열을 고쳐도 로스터가 오염되지 않는다', () => {
    const first = listBlocks()
    first.length = 0
    expect(listBlocks().length).toBeGreaterThan(0)
    const vesselBlocks = blocksOfVessel('7004')
    vesselBlocks.length = 0
    expect(blocksOfVessel('7004').length).toBeGreaterThan(0)
  })

  it('블록 선택지는 로스터 블록과 번호·공장이 같다 (통합실적 필터가 다른 이름을 쓰지 않는다)', () => {
    for (const vessel of listVessels()) {
      const blocks = blocksOfVessel(vessel.projNo)
      expect(blockOptionsOfVessel(vessel.projNo)).toEqual(
        blocks.map((b) => ({ blockNo: b.blockNo, factory: b.factory }))
      )
    }
  })

  it('공정존별 목록의 합이 전체와 같다 (어느 존에도 속하지 않는 블록이 없다)', () => {
    const total =
      blocksInZone('fabrication').length +
      blocksInZone('assembly').length +
      blocksInZone('outfitting').length +
      blocksInZone('painting').length
    expect(total).toBe(listBlocks().length)
  })

  it('의장 블록은 의장 공장 조회로도 나온다', () => {
    for (const block of blocksInZone('outfitting')) {
      expect(blocksAtOutfittingFactory(block.outfitting!.factoryId)).toContain(block)
    }
  })
})

describe('공정 화면 경로 — 통합실적 → 공정 딥링크', () => {
  it('정반이 정해진 블록은 그 정반 상세까지 간다', () => {
    const block = blocksWithCadModel()[0]
    expect(zonePathOfBlock(block)).toBe(
      `/zones/assembly/${block.berth!.factoryId}/${block.berth!.bayId}`
    )
  })

  it('정반이 없으면 그 공장을 연 맵 진입 화면으로 (`?shop=` 기존 문법)', () => {
    const block = blocksInZone('outfitting')[0]
    expect(zonePathOfBlock(block)).toBe(
      `/zones/outfitting?shop=${encodeURIComponent(block.factory)}`
    )
  })

  it('공장명의 한글·공백이 인코딩된다 (URL 이 깨지지 않는다)', () => {
    const block = blocksInZone('outfitting').find((b) => b.factory.includes(' '))
    expect(block).toBeTruthy()
    expect(zonePathOfBlock(block!)).not.toContain(' ')
  })
})
