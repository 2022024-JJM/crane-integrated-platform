import { describe, expect, it } from 'vitest'
import {
  colorOfParcelCategory,
  type YardParcelLot,
  type YardParcels,
} from '../../../entities/yard-parcels'
import {
  demoteNonMemberLots,
  memberExtentOf,
  memberFactoriesOf,
  memberProcessesOf,
  orderFactoryNames,
  sameBounds,
} from '../lib/members'

/*
 * 프레임의 순수 계산 검증 — 특히 "주인공 밖 지번의 강등"은 도장 화면(PaintingYardMap)이
 * 하던 것과 **똑같이** 동작해야 하고(회귀 0), 서로 다른 공정의 공장을 섞어도(조립+CAS/PAS)
 * 각자 제 공정을 유지해야 한다.
 */

const lot = (over: Partial<YardParcelLot> & { lot: string }): YardParcelLot => ({
  factory: null,
  process: '',
  category: '공장(Shop)',
  label: `설명 ${over.lot}`,
  area: 1000,
  place: '옥내',
  polygon: [
    { lat: 34.87, lon: 128.7 },
    { lat: 34.871, lon: 128.701 },
  ],
  ...over,
})

const parcels = (): YardParcels => ({
  lots: [
    lot({ lot: 'DL1', factory: '도장5공장', process: '도장' }),
    /* 도장 공정이지만 어느 공장에도 안 묶인 지번 — 도장 홈 범위에는 들어가던 땅 */
    lot({
      lot: 'DL9',
      factory: null,
      process: '도장',
      polygon: [
        { lat: 34.9, lon: 128.75 },
        { lat: 34.91, lon: 128.76 },
      ],
    }),
    lot({ lot: 'AL1', factory: '조립1공장', process: '조립' }),
    lot({ lot: 'CL1', factory: 'CAS', process: '가공' }),
    lot({ lot: 'XL1', factory: '의장1공장', process: '의장' }),
  ],
  factories: [
    { name: '도장5공장', process: '도장', lotCodes: ['DL1'], labelAnchor: { lat: 34.87, lon: 128.7 } },
    { name: '조립1공장', process: '조립', lotCodes: ['AL1'], labelAnchor: { lat: 34.87, lon: 128.7 } },
    { name: 'CAS', process: '가공', lotCodes: ['CL1'], labelAnchor: { lat: 34.87, lon: 128.7 } },
    { name: '의장1공장', process: '의장', lotCodes: ['XL1'], labelAnchor: { lat: 34.87, lon: 128.7 } },
  ],
  bays: [],
  categoryColor: colorOfParcelCategory,
})

describe('memberFactoriesOf — 주인공 공장 판정', () => {
  it('이름 목록에 든 공장만, parcels 등장 순서대로 남긴다', () => {
    const members = memberFactoriesOf(parcels(), ['CAS', '조립1공장'])
    expect(members.map((f) => f.name)).toEqual(['조립1공장', 'CAS'])
  })
})

describe('demoteNonMemberLots — 주인공 밖 지번의 강등', () => {
  it('주인공 소속 지번은 그대로, 나머지는 소속·공정을 지운 무색 실루엣이 된다', () => {
    const p = parcels()
    const demoted = demoteNonMemberLots(p, memberFactoriesOf(p, ['도장5공장']))
    const byLot = new Map(demoted.map((l) => [l.lot, l]))
    expect(byLot.get('DL1')).toMatchObject({ factory: '도장5공장', process: '도장' })
    /* 도장 공정이라도 주인공 공장 소속이 아니면 강등 — 도장 화면의 기존 판정과 동일 */
    expect(byLot.get('DL9')).toMatchObject({ factory: null, process: '' })
    expect(byLot.get('AL1')).toMatchObject({ factory: null, process: '' })
  })

  it('서로 다른 공정의 공장을 섞으면(조립+CAS/PAS) 각자 제 공정색 근거를 유지한다', () => {
    const p = parcels()
    const demoted = demoteNonMemberLots(p, memberFactoriesOf(p, ['조립1공장', 'CAS']))
    const byLot = new Map(demoted.map((l) => [l.lot, l]))
    expect(byLot.get('AL1')?.process).toBe('조립')
    expect(byLot.get('CL1')?.process).toBe('가공')
    expect(byLot.get('DL1')).toMatchObject({ factory: null, process: '' })
  })
})

describe('memberProcessesOf — 스포트라이트 공정 집합', () => {
  it('주인공 공장들의 공정을 중복 없이 모은다', () => {
    const p = parcels()
    expect(memberProcessesOf(memberFactoriesOf(p, ['조립1공장', 'CAS']))).toEqual([
      '조립',
      '가공',
    ])
    expect(memberProcessesOf(memberFactoriesOf(p, ['도장5공장']))).toEqual(['도장'])
  })
})

describe('memberExtentOf — 홈 범위', () => {
  const fallback = { minLat: 0, minLon: 0, maxLat: 1, maxLon: 1 }

  it('필터에 걸린 지번 전 정점의 bounds 를 낸다 — 소비자 잣대(도장: lot.process) 주입 가능', () => {
    const byProcess = memberExtentOf(parcels(), (l) => l.process === '도장', fallback)
    /* 무소속 도장 지번(DL9, 북동쪽)까지 담겨 범위가 넓어진다 — 도장 화면의 기존 홈 */
    expect(byProcess.maxLat).toBeCloseTo(34.91)
    const byFactory = memberExtentOf(parcels(), (l) => l.factory === '도장5공장', fallback)
    expect(byFactory.maxLat).toBeCloseTo(34.871)
  })

  it('걸린 지번이 없으면 fallback 을 낸다', () => {
    expect(memberExtentOf(parcels(), () => false, fallback)).toEqual(fallback)
  })
})

describe('orderFactoryNames — 드릴인한 카드가 목록 제일 위로', () => {
  const names = ['A', 'B', 'C'] as const

  it('드릴인 중이면 고른 공장이 앞으로 온다', () => {
    expect(orderFactoryNames(names, 'B', false)).toEqual(['B', 'A', 'C'])
  })

  it('전체 보기·목록에 없는 공장이면 원래 순서 그대로다', () => {
    expect(orderFactoryNames(names, 'B', true)).toEqual(names)
    expect(orderFactoryNames(names, 'Z', false)).toEqual(names)
  })
})

/*
 * B1(도장 확대 깜빡임) 회귀 방지 — 카메라 목표의 정체성 안정화 잣대.
 * 같은 값의 새 객체가 시계·폴링 재렌더마다 focusBounds 로 흘러들면 지도가 매초
 * 제 프레이밍으로 되돌아 난다. sameBounds 가 그 사슬을 값 비교로 끊는다.
 */
describe('sameBounds — 카메라 목표 정체성 안정화', () => {
  const bounds = { minLat: 34.86, maxLat: 34.88, minLon: 128.69, maxLon: 128.72 }

  it('같은 값의 새 객체는 같다 (시계 재렌더의 재계산 결과)', () => {
    expect(sameBounds(bounds, { ...bounds })).toBe(true)
    expect(sameBounds(bounds, bounds)).toBe(true)
  })

  it('값이 하나라도 다르면 다르다 (진짜 카메라 이동)', () => {
    expect(sameBounds(bounds, { ...bounds, maxLat: 34.89 })).toBe(false)
    expect(sameBounds(bounds, { ...bounds, minLon: 128.68 })).toBe(false)
  })

  it('null 은 null 하고만 같다', () => {
    expect(sameBounds(null, null)).toBe(true)
    expect(sameBounds(bounds, null)).toBe(false)
    expect(sameBounds(null, bounds)).toBe(false)
  })
})
