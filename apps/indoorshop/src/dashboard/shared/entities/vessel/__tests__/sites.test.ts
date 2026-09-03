import { describe, expect, it } from 'vitest'
import { parseDrilldown } from '../../../lib/drilldownUrl'
import {
  isBlockInTransition,
  isBlockTrackable,
  sitesOfBlock,
  zonesOfSites,
} from '../lib/sites'
import { blocksInZone, findBlock, listBlocks } from '../lib/roster'

/** "이 블록 어디 있어요" 의 답 — 점 하나가 아니라는 것이 계약의 요지다 */
describe('블록 자리 — 가공 중', () => {
  it('가공 중인 블록은 자리가 없다 (없는 위치를 공장 앵커로 찍지 않는다)', () => {
    const fab = blocksInZone('fabrication')
    expect(fab.length).toBeGreaterThan(0)
    for (const block of fab) {
      expect(sitesOfBlock(block), `${block.projNo}-${block.blockNo}`).toEqual([])
      expect(isBlockTrackable(block)).toBe(false)
    }
  })

  it('가공 블록도 공장 이름은 있다 — 추적이 없을 뿐 어디서 만드는지는 안다', () => {
    for (const block of blocksInZone('fabrication')) {
      expect(block.factory).toBeTruthy()
    }
  })
})

describe('블록 자리 — 조립 중 (ASSY 분산)', () => {
  const scattered = findBlock('7004', '222')!

  it('ASSY 가 흩어진 블록은 자리가 여럿이다', () => {
    const sites = sitesOfBlock(scattered)
    expect(sites.length).toBeGreaterThan(1)
    expect(new Set(sites.map((s) => s.factory)).size).toBeGreaterThan(1)
  })

  it('같은 공장·베이의 ASSY 는 한 마커로 묶인다 (핀이 지도를 덮지 않게)', () => {
    const sites = sitesOfBlock(scattered)
    expect(new Set(sites.map((s) => s.id)).size).toBe(sites.length)
    const nps = sites.find((s) => s.factory === 'NPS')!
    expect(nps.assys.map((a) => a.assyNo)).toEqual(['7004-222-S03', '7004-222-S04'])
  })

  it('모든 ASSY 가 어느 자리엔가 실린다 (묶다가 흘리지 않는다)', () => {
    for (const block of listBlocks()) {
      if (!block.assyUnits) continue
      const carried = sitesOfBlock(block).flatMap((s) => s.assys.map((a) => a.assyNo))
      expect([...carried].sort()).toEqual([...block.assyUnits.map((u) => u.assyNo)].sort())
    }
  })

  it('자리 순서는 ASSY 많은 곳 먼저 — 렌더링마다 흔들리지 않는다', () => {
    const counts = sitesOfBlock(findBlock('2540', '283')!).map((s) => s.assys.length)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    expect(sitesOfBlock(scattered)).toEqual(sitesOfBlock(scattered))
  })

  it('정반이 정해진 ASSY 자리는 그 정반 상세로, 아니면 그 공장을 연 맵으로', () => {
    const sites = sitesOfBlock(scattered)
    expect(sites.find((s) => s.factory === 'NPS')!.path).toBe('/zones/assembly/asm-nps/asm-nps-b1')
    /* 값은 안정 슬러그(F-30) — asm-of1 이 조립4공장-OFD1 의 표 등재 슬러그다 */
    expect(sites.find((s) => s.factory === '조립4공장-OFD1')!.path).toBe(
      '/zones/assembly?factory=asm-of1'
    )
  })
})

describe('블록 자리 — 의장·도장 중', () => {
  it('의장 블록은 그 구역 한 자리', () => {
    const block = findBlock('2540', '286')!
    const sites = sitesOfBlock(block)
    expect(sites).toHaveLength(1)
    expect(sites[0]).toMatchObject({ zone: 'outfitting', factory: 'POS 1공장', mapBay: '1' })
  })

  it('도장 블록은 BTS 귀속 도장공장 한 자리', () => {
    const painting = blocksInZone('painting')
    expect(painting.length).toBeGreaterThan(0)
    for (const block of painting) {
      const sites = sitesOfBlock(block)
      expect(sites).toHaveLength(1)
      expect(sites[0].zone).toBe('painting')
      expect(sites[0].factory).toBe(block.factory)
      expect(sites[0].path.startsWith('/zones/painting?factory=')).toBe(true)
      expect(parseDrilldown(sites[0].path.split('?')[1]).factory).toBe(block.factory)
    }
  })
})

/*
 * **단계 전이 = 이 공정에 막 넘어옴** (W6-2 교정).
 *
 * 예전 모델은 '대조만 먼저 도장으로 넘어간 블록'이었다. 그 모양은 공정 순서
 * (가공 → 조립 → 의장 → 도장)와 어긋난다 — 소조·중조는 대조 **안에** 들어가므로 대조가
 * 도장에 가 있는데 하위가 조립 공장에 남아 있을 수 없고, 블록이 조립도 안 끝났는데 도장
 * 작업이 돌 수도 없다. 흩어짐은 조립 단계 안의 사실이고, 전이는 단계 경계에서 일어난다.
 */
describe('블록 자리 — 단계 전이 중', () => {
  it('자리 공정은 언제나 블록 단계와 같다 — ASSY 분산은 조립 안에서만', () => {
    for (const block of listBlocks()) {
      for (const site of sitesOfBlock(block)) {
        expect(site.zone, `${block.projNo}-${block.blockNo}: ${site.id}`).toBe(block.zone)
      }
      /* 분산(ASSY 다중 자리)을 적은 블록은 전부 조립 단계다 */
      if (block.assyUnits) expect(block.zone, `${block.projNo}-${block.blockNo}`).toBe('assembly')
    }
  })

  it('전이 블록도 자리는 하나 — 넘어온 공정의 그 자리다', () => {
    for (const block of listBlocks().filter(isBlockInTransition)) {
      const sites = sitesOfBlock(block)
      expect(sites, `${block.projNo}-${block.blockNo}`).toHaveLength(1)
      expect(zonesOfSites(sites)).toEqual([block.zone])
    }
  })

  it('전이 표본이 의장·도장 양쪽에 있다 (경계 시나리오가 화면에서 재현 가능해야 한다)', () => {
    const zones = new Set(listBlocks().filter(isBlockInTransition).map((b) => b.zone))
    expect(zones.has('outfitting')).toBe(true)
    expect(zones.has('painting')).toBe(true)
  })
})

describe('블록 자리 — 전 로스터 불변식', () => {
  it('가공 외의 모든 블록은 자리가 하나 이상 있다', () => {
    for (const block of listBlocks()) {
      if (block.zone === 'fabrication') continue
      expect(sitesOfBlock(block).length, `${block.projNo}-${block.blockNo}`).toBeGreaterThan(0)
    }
  })

  it('자리 id 는 (공정, 공장, 베이) 를 그대로 담는다 — 마커 key 가 겹치지 않게', () => {
    for (const block of listBlocks()) {
      for (const site of sitesOfBlock(block)) {
        expect(site.id).toBe(`${site.zone}@${site.factory}#${site.mapBay ?? '-'}`)
      }
    }
  })
})
