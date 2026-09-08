import { describe, expect, it } from 'vitest'
import { loadYardParcels } from '../../../entities/yard-parcels'
import { findBlock, sitesOfBlock } from '../../../entities/vessel'
import { boundsOfSites, locateSite, locateSites, type LocatedSite } from '../lib/blockSites'

const parcels = await loadYardParcels()

const site = (over: Partial<Parameters<typeof locateSite>[1]> = {}) => ({
  id: 'assembly@PBS#1',
  zone: 'assembly' as const,
  factory: 'PBS',
  mapBay: '1',
  assys: [],
  path: '/indoorshop/zones/assembly',
  ...over,
})

describe('자리 → 지도 점', () => {
  it('(공장, 베이) 가 풀리면 그 베이 지번의 가운데를 찍는다', () => {
    const located = locateSite(parcels, site())!
    expect(located.bayResolved).toBe(true)
    expect(located.lotCodes.length).toBeGreaterThan(0)
    expect(located.lat).toBeGreaterThan(34)
    expect(located.lon).toBeGreaterThan(128)
  })

  it('베이를 못 풀면 공장 앵커로 물러난다 — "그 공장 어딘가"까지는 참말이다', () => {
    const located = locateSite(parcels, site({ mapBay: undefined }))!
    expect(located.bayResolved).toBe(false)
    expect(located.lotCodes.length).toBeGreaterThan(0)
  })

  it('없는 베이도 공장으로 물러난다 (자리를 통째로 버리지 않는다)', () => {
    expect(locateSite(parcels, site({ mapBay: '99' }))!.bayResolved).toBe(false)
  })

  it('공장조차 모르면 null — 아무 데나 찍느니 안 찍는다', () => {
    expect(locateSite(parcels, site({ factory: '없는공장' }))).toBeNull()
  })

  it('베이가 다르면 점도 다르다 (한 공장 안의 정반을 구분해 찍는다)', () => {
    const a = locateSite(parcels, site({ mapBay: '1' }))!
    const b = locateSite(parcels, site({ id: 'assembly@PBS#8', mapBay: '8' }))!
    expect(a.lat === b.lat && a.lon === b.lon).toBe(false)
  })

  it('못 푼 자리는 조용히 빠지고 나머지 순서는 그대로', () => {
    const located = locateSites(parcels, [
      site({ id: 'a' }),
      site({ id: 'b', factory: '없는공장' }),
      site({ id: 'c', mapBay: '8' }),
    ])
    expect(located.map((s) => s.id)).toEqual(['a', 'c'])
  })
})

describe('자리 → 카메라 상자', () => {
  const pt = (lat: number, lon: number): LocatedSite =>
    ({ ...site(), lat, lon, lotCodes: [], bayResolved: true }) as LocatedSite

  it('자리가 없으면 null — 카메라를 움직이지 않는다 (가공 중 블록)', () => {
    expect(boundsOfSites([])).toBeNull()
  })

  it('자리가 하나면 그 주변 상자 — 한 점에 카메라를 맞추면 배율이 무한대가 된다', () => {
    const b = boundsOfSites([pt(34.87, 128.7)])!
    expect(b.maxLat - b.minLat).toBeCloseTo(0.0012, 6)
    expect(b.maxLon - b.minLon).toBeCloseTo(0.0014, 6)
  })

  it('멀리 흩어진 자리는 전부 감싼다', () => {
    const b = boundsOfSites([pt(34.86, 128.69), pt(34.88, 128.72)])!
    expect(b.minLat).toBeLessThanOrEqual(34.86)
    expect(b.maxLat).toBeGreaterThanOrEqual(34.88)
    expect(b.minLon).toBeLessThanOrEqual(128.69)
    expect(b.maxLon).toBeGreaterThanOrEqual(128.72)
  })

  it('가까운 자리들은 최소 크기가 보장된다 (같은 공장 두 정반에 파고들지 않게)', () => {
    const b = boundsOfSites([pt(34.87, 128.7), pt(34.870_05, 128.700_05)])!
    expect(b.maxLat - b.minLat).toBeGreaterThanOrEqual(0.0012 - 1e-9)
    expect(b.maxLon - b.minLon).toBeGreaterThanOrEqual(0.0014 - 1e-9)
  })
})

describe('실제 블록 — 시나리오별', () => {
  it('가공 중: 찍을 점이 없다', () => {
    expect(locateSites(parcels, sitesOfBlock(findBlock('7004', '612')!))).toEqual([])
  })

  it('조립 중 ASSY 분산: 여러 점이 서로 다른 자리에 선다', () => {
    const located = locateSites(parcels, sitesOfBlock(findBlock('7004', '222')!))
    expect(located.length).toBeGreaterThan(3)
    expect(new Set(located.map((s) => `${s.lat},${s.lon}`)).size).toBe(located.length)
    expect(located.every((s) => s.bayResolved || s.factory === '조립4공장-OFD1')).toBe(true)
  })

  it('조립 후반: 분산이 좁아져도 점은 여전히 조립 공정 하나로만 칠해진다', () => {
    /* 2543-642 는 대부분이 대조 정반에 합쳐지고 소조 둘만 남은 조립 후반 표본이다.
       예전에는 '대조만 먼저 도장으로 넘어간' 모양이었으나 공정 순서와 어긋나 교정했다. */
    const located = locateSites(parcels, sitesOfBlock(findBlock('2543', '642')!))
    expect(new Set(located.map((s) => s.zone))).toEqual(new Set(['assembly']))
    expect(located.length).toBeGreaterThan(1)
  })

  it('전이(갓 반입): 넘어온 공정의 점 하나', () => {
    expect(locateSites(parcels, sitesOfBlock(findBlock('2543', '651')!))).toHaveLength(1)
    expect(locateSites(parcels, sitesOfBlock(findBlock('2543', '660')!))).toHaveLength(1)
  })

  it('의장·도장 중: 점 하나', () => {
    expect(locateSites(parcels, sitesOfBlock(findBlock('2540', '286')!))).toHaveLength(1)
    expect(locateSites(parcels, sitesOfBlock(findBlock('7012', '117')!))).toHaveLength(1)
  })

  it('로스터 전 블록의 자리가 하나도 빠짐없이 풀린다', async () => {
    const { listBlocks } = await import('../../../entities/vessel')
    for (const block of listBlocks()) {
      const sites = sitesOfBlock(block)
      expect(
        locateSites(parcels, sites).length,
        `${block.projNo}-${block.blockNo}`
      ).toBe(sites.length)
    }
  })
})
