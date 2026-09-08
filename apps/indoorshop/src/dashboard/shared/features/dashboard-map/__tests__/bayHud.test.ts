import { describe, expect, it } from 'vitest'
import {
  colorOfParcelCategory,
  type YardParcelLot,
  type YardParcels,
} from '../../../entities/yard-parcels'
import { bayHudTarget } from '../lib/bayHud'

/*
 * 고른 베이의 떠 있는 이름패가 설 자리 — 실루엣은 **소속 지번**에서 나온다(볼록 껍질
 * `hull` 이 아니라). 그래야 패가 화면에 실제로 서 있는 건물 위에 선다.
 */

const square = (lat: number, lon: number) => [
  { lat, lon },
  { lat: lat + 0.001, lon },
  { lat: lat + 0.001, lon: lon + 0.001 },
  { lat, lon: lon + 0.001 },
]

const lot = (code: string, lat: number, lon: number): YardParcelLot => ({
  lot: code,
  factory: 'PBS',
  process: '조립',
  category: '공장(Shop)',
  label: `설명 ${code}`,
  area: 1000,
  place: '옥내',
  polygon: square(lat, lon),
})

const parcels = (): YardParcels => ({
  lots: [lot('PB6B01', 34.87, 128.7), lot('PB6B02', 34.87, 128.702), lot('PB7B01', 34.88, 128.71)],
  factories: [
    {
      name: 'PBS',
      process: '조립',
      lotCodes: ['PB6B01', 'PB6B02', 'PB7B01'],
      labelAnchor: { lat: 34.87, lon: 128.7 },
    },
  ],
  bays: [
    {
      bayKey: 'BAY006',
      factory: 'PBS',
      bay: '6',
      id: 'PBS#6',
      label: '6BAY',
      process: '조립',
      lotCodes: ['PB6B01', 'PB6B02'],
      /* 껍질은 일부러 엉뚱한 자리에 둔다 — 패가 이것을 쓰지 않는다는 것을 잡아낸다 */
      hull: square(35.9, 129.9),
    },
    {
      bayKey: 'BAY009',
      factory: 'PBS',
      bay: '9',
      id: 'PBS#9',
      label: '9BAY',
      /* 원본 bays.js 의 공정 빈칸 — 소속 공장의 공정으로 메운다 */
      process: '',
      lotCodes: ['PB9B01'],
      hull: [],
    },
  ],
  categoryColor: colorOfParcelCategory,
})

describe('bayHudTarget — 베이 이름패의 자리', () => {
  it('실루엣은 소속 지번 폴리곤의 꼭짓점 전부다 — 다른 베이의 지번은 섞이지 않는다', () => {
    const target = bayHudTarget(parcels(), 'PBS#6')!
    expect(target.name).toBe('6BAY')
    expect(target.factory).toBe('PBS')
    expect(target.outline).toHaveLength(8)
    /* 7BAY 의 지번(34.88)은 이 베이의 실루엣이 아니다 */
    expect(target.outline.every((p) => p.lat < 34.875)).toBe(true)
  })

  it('가로 자리는 소속 지번 정점의 평균 — 볼록 껍질(hull)을 쓰지 않는다', () => {
    const target = bayHudTarget(parcels(), 'PBS#6')!
    expect(target.anchor.lat).toBeCloseTo(34.8705, 6)
    expect(target.anchor.lon).toBeCloseTo(128.7015, 6)
  })

  it('공정이 빈칸인 베이는 소속 공장의 공정으로 메운다 — 색이 회색으로 떨어지지 않게', () => {
    const data = parcels()
    data.bays[1].lotCodes = ['PB6B01']
    expect(bayHudTarget(data, 'PBS#9')?.process).toBe('조립')
  })

  it('없는 베이·지도에 지번이 없는 베이는 null — 잴 실루엣이 없으면 패도 없다', () => {
    expect(bayHudTarget(parcels(), 'PBS#42')).toBeNull()
    expect(bayHudTarget(parcels(), 'PBS#9')).toBeNull()
  })
})
