import { describe, expect, it } from 'vitest'
import {
  colorOfParcelCategory,
  type YardParcelLot,
  type YardParcels,
} from '../../../entities/yard-parcels'
import type { ProcessMapLocation } from '../../../model/processMapDrilldown'
import { locationOfBay, summarizeBay } from '../lib/bayDetail'

const lot = (over: Partial<YardParcelLot> & { lot: string }): YardParcelLot => ({
  factory: 'PBS',
  process: '조립',
  category: '공장(Shop)',
  label: `설명 ${over.lot}`,
  area: 1000,
  place: '옥내',
  polygon: [
    { lat: 34.87, lon: 128.7 },
    { lat: 34.871, lon: 128.7 },
    { lat: 34.871, lon: 128.701 },
    { lat: 34.87, lon: 128.701 },
  ],
  ...over,
})

const parcels = (): YardParcels => ({
  lots: [
    lot({ lot: 'PB1B01', label: 'PBS 1BAY-01', area: 2013 }),
    lot({ lot: 'PB1B02', label: 'PBS 1BAY-02', area: 1263 }),
    lot({ lot: 'PB1B03', label: 'PBS 1BAY-03', area: 1820, place: '옥외' }),
    lot({ lot: 'PB2B01', label: 'PBS 2BAY-01', area: 1038 }),
  ],
  factories: [
    {
      name: 'PBS',
      process: '조립',
      lotCodes: ['PB1B01', 'PB1B02', 'PB1B03', 'PB2B01'],
      labelAnchor: { lat: 34.87, lon: 128.7 },
    },
  ],
  bays: [
    { bayKey: 'BAY001', factory: 'PBS', bay: '1', id: 'PBS#1', label: '1BAY', process: '조립', lotCodes: ['PB1B01', 'PB1B02', 'PB1B03'], hull: [] },
    { bayKey: 'BAY002', factory: 'PBS', bay: '2', id: 'PBS#2', label: '2BAY', process: '조립', lotCodes: ['PB2B01'], hull: [] },
    /* 지도 fixture 에 지번이 하나도 없는 베이 — 매핑이 앞서 나간 상태 */
    { bayKey: 'BAY009', factory: 'PBS', bay: '9', id: 'PBS#9', label: '9BAY', process: '조립', lotCodes: ['PB9B01'], hull: [] },
  ],
  categoryColor: colorOfParcelCategory,
})

describe('summarizeBay — 베이 한 칸의 지번·설명 집계', () => {
  it('소속 지번을 매핑 순서 그대로 펴고, 설명은 원본 그대로 옮긴다', () => {
    const summary = summarizeBay(parcels(), 'PBS#1')
    expect(summary?.label).toBe('1BAY')
    expect(summary?.factory).toBe('PBS')
    expect(summary?.process).toBe('조립')
    expect(summary?.lots.map((l) => l.lot)).toEqual(['PB1B01', 'PB1B02', 'PB1B03'])
    expect(summary?.lots.map((l) => l.description)).toEqual([
      'PBS 1BAY-01',
      'PBS 1BAY-02',
      'PBS 1BAY-03',
    ])
  })

  it('면적은 합, 옥내·옥외는 지번 수로 센다', () => {
    const summary = summarizeBay(parcels(), 'PBS#1')
    expect(summary?.area).toBe(2013 + 1263 + 1820)
    expect(summary?.indoor).toBe(2)
    expect(summary?.outdoor).toBe(1)
  })

  it('없는 베이는 null 이다', () => {
    expect(summarizeBay(parcels(), 'PBS#42')).toBeNull()
  })

  it('지도 fixture 에 지번이 하나도 없는 베이는 빈 카드를 세우지 않는다 (null)', () => {
    expect(summarizeBay(parcels(), 'PBS#9')).toBeNull()
  })
})

const location = (id: string, codes?: string[]): ProcessMapLocation => ({
  id,
  parentFacilityKey: 'PBS',
  displayName: id,
  yardLotCodes: codes,
  detailPath: `/indoorshop/zones/assembly/asm-pbs/${id}`,
})

describe('locationOfBay — 지도의 베이 ↔ 공정의 작업 위치를 지번으로 잇는다', () => {
  it('겹치는 지번이 가장 많은 작업 위치를 짝으로 본다', () => {
    const picked = locationOfBay(
      [location('b-1', ['PB1B01']), location('b-2', ['PB1B02', 'PB1B03'])],
      ['PB1B01', 'PB1B02', 'PB1B03']
    )
    expect(picked?.id).toBe('b-2')
  })

  it('겹치는 지번이 하나도 없으면 짝이 없다 — 없는 링크를 만들지 않는다', () => {
    expect(locationOfBay([location('b-1', ['PB5B01'])], ['PB1B01'])).toBeNull()
  })

  it('지도 연결 키가 없는 작업 위치는 후보가 되지 않는다', () => {
    expect(locationOfBay([location('b-1'), location('b-2', [])], ['PB1B01'])).toBeNull()
  })
})
