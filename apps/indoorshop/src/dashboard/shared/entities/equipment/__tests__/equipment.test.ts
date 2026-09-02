import { describe, expect, it } from 'vitest'
import { EQUIPMENT_TYPES, YARD_EQUIPMENT, equipmentOfTypes, equipmentTypeOf } from '..'
import { loadYardParcels } from '../../yard-parcels'

/**
 * 야드 설비 fixture 의 **정합성**.
 *
 * `equipmentFixture.ts` 는 painting 원본에서 생성기가 다시 만드는 생성물이라, 원본이
 * 바뀌면 조용히 어긋날 수 있다 — 종류 레지스트리에 없는 typeId, 지도에 없는 (공장,베이)를
 * 가리키는 설비는 화면에서 소리 없이 빠진다. 그래서 여기서 잡는다.
 */
describe('야드 설비 fixture', () => {
  it('설비 503대 · 종류 11종 — 260901 도면(조립 9공장) 반영 기준', () => {
    expect(YARD_EQUIPMENT).toHaveLength(503)
    expect(EQUIPMENT_TYPES).toHaveLength(11)
  })

  it('종류별 대수 — LiDAR·틸팅 204쌍 + 패널 9 + 제습기/가스히터 86', () => {
    const byType = new Map<string, number>()
    for (const e of YARD_EQUIPMENT) byType.set(e.typeId, (byType.get(e.typeId) ?? 0) + 1)
    expect(Object.fromEntries(byType)).toEqual({
      LIDAR: 204,
      TILT: 204,
      PNL: 9,
      DH: 43,
      GH: 43,
    })
  })

  it('공장별 대수가 원본 배치와 일치한다', () => {
    const byFactory = new Map<string, number>()
    for (const e of YARD_EQUIPMENT) byFactory.set(e.factory, (byFactory.get(e.factory) ?? 0) + 1)
    expect(Object.fromEntries(byFactory)).toEqual({
      PBS: 89,
      GBS: 85,
      NPS: 61,
      '조립4공장-OFD1': 53,
      '3DS': 47,
      '1DOCK 도장공장': 30,
      CAS: 27,
      '조립4공장-OFD3': 21,
      '2DOCK 도장공장': 20,
      '느태 도장공장': 20,
      '조립4공장-OFD2': 19,
      PAS: 15,
      '텍사코 도장공장': 10,
      GPS: 6,
    })
  })

  it('모든 설비의 typeId 가 종류 레지스트리에 실재한다', () => {
    const unknown = YARD_EQUIPMENT.filter((e) => equipmentTypeOf(e.typeId) === null)
    expect(unknown).toEqual([])
  })

  it('베이가 있는 설비는 지도 베이(공장#베이 복합키)로 풀린다 — 베이명 단독으론 못 잇는다', async () => {
    const { bays } = await loadYardParcels()
    const known = new Set(bays.map((b) => b.id))
    const orphans = YARD_EQUIPMENT.filter((e) => e.bay && !known.has(`${e.factory}#${e.bay}`))
    expect(orphans.map((e) => `${e.id}:${e.factory}#${e.bay}`)).toEqual([])
  })

  it('도장 몫(DH/GH)은 86대 — SCADA 가 그리는 물량', () => {
    expect(equipmentOfTypes(['DH', 'GH'])).toHaveLength(86)
  })
})
