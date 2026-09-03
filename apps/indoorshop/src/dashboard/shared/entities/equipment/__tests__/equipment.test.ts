import { describe, expect, it } from 'vitest'
import {
  CABINET_TYPE_IDS,
  EQUIPMENT_PANELS,
  EQUIPMENT_TYPES,
  YARD_EQUIPMENT,
  equipmentOfPanel,
  equipmentOfTypes,
  equipmentPanelOf,
  equipmentTypeOf,
  lidarTiltPairs,
  pairIdOf,
  pairOf,
  panelImpact,
  panelsOfFactory,
  yardEquipmentOf,
} from '..'
import { loadYardParcels } from '../../yard-parcels'

/**
 * 야드 설비 fixture 의 **정합성**.
 *
 * `equipmentFixture.ts` 는 painting 원본에서 생성기가 다시 만드는 생성물이라, 원본이
 * 바뀌면 조용히 어긋날 수 있다 — 종류 레지스트리에 없는 typeId, 지도에 없는 (공장,베이)를
 * 가리키는 설비, 짝이 없어진 라이다-틸팅 페어, 실재하지 않는 캐비닛을 가리키는 patchId
 * 는 전부 화면에서 소리 없이 빠지거나 반쪽으로 그려진다. 그래서 여기서 잡는다.
 */
describe('야드 설비 fixture', () => {
  it('설비 841대 · 종류 11종 — 260903 교체판 도면(조립 9 + 의장 7) 반영 기준', () => {
    expect(YARD_EQUIPMENT).toHaveLength(841)
    expect(EQUIPMENT_TYPES).toHaveLength(11)
  })

  it('종류별 대수 — 라이다·틸팅 337쌍 + Network Panel 49 + Edge PC 32 + 도장 86', () => {
    const byType = new Map<string, number>()
    for (const e of YARD_EQUIPMENT) byType.set(e.typeId, (byType.get(e.typeId) ?? 0) + 1)
    expect(Object.fromEntries(byType)).toEqual({
      LIDAR: 337,
      TILT: 337,
      PNL: 49,
      EDGE: 32,
      DH: 43,
      GH: 43,
    })
  })

  it('공장별 대수가 원본 배치와 일치한다', () => {
    const byFactory = new Map<string, number>()
    for (const e of YARD_EQUIPMENT) byFactory.set(e.factory, (byFactory.get(e.factory) ?? 0) + 1)
    expect(Object.fromEntries(byFactory)).toEqual({
      PBS: 101,
      'POS 1공장': 97,
      GBS: 96,
      '조립의장 1공장 BOS 1': 81,
      NPS: 70,
      '두모 선행의장 2공장': 66,
      '조립4공장-OFD1': 58,
      '3DS': 51,
      '1DOCK 도장공장': 30,
      CAS: 28,
      '조립4공장-OFD3': 24,
      '조립4공장-OFD2': 21,
      '2DOCK 도장공장': 20,
      '느태 도장공장': 20,
      'GOS 조립의장 쉘터': 17,
      PAS: 16,
      '조립의장 2공장 BOS 2': 13,
      '조립의장 3공장 쉘터': 11,
      '텍사코 도장공장': 10,
      GPS: 6,
      'OFD조립의장 셸터': 5,
    })
  })

  it('설비 ID 는 전역 유일하고, ID 로 되찾을 수 있다', () => {
    expect(new Set(YARD_EQUIPMENT.map((e) => e.id)).size).toBe(YARD_EQUIPMENT.length)
    expect(yardEquipmentOf('LD-D01')?.typeId).toBe('LIDAR')
    expect(yardEquipmentOf('없는설비')).toBeNull()
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

  it('도장 몫(DH/GH)은 86대 — SCADA 가 그리는 물량(회귀 방지)', () => {
    expect(equipmentOfTypes(['DH', 'GH'])).toHaveLength(86)
  })
})

describe('라이다 ↔ 틸팅 페어', () => {
  it('337쌍 — 라이다 한 대마다 같은 꼬리의 틸팅이 있다', () => {
    expect(lidarTiltPairs()).toHaveLength(337)
  })

  it('페어는 공장·베이·캐비닛을 공유한다 (한 자리에 함께 선다)', () => {
    const broken = lidarTiltPairs().filter(
      ({ lidar, tilt }) =>
        lidar.factory !== tilt.factory ||
        lidar.bay !== tilt.bay ||
        lidar.panelId !== tilt.panelId
    )
    expect(broken.map((p) => p.lidar.id)).toEqual([])
  })

  it('페어 관계는 양방향이다 — 틸팅에서 되짚어도 같은 라이다', () => {
    const lidar = yardEquipmentOf('LD-D01')!
    const tilt = pairOf(lidar)!
    expect(tilt.id).toBe('PT-D01')
    expect(pairOf(tilt)?.id).toBe('LD-D01')
  })

  it('페어 대상이 아닌 설비는 상대가 없다', () => {
    const panel = YARD_EQUIPMENT.find((e) => e.typeId === 'PNL')!
    expect(pairIdOf(panel)).toBeNull()
    expect(pairOf(panel)).toBeNull()
  })
})

describe('캐비닛(패널) 기준정보', () => {
  it('캐비닛 81대 — Network Panel 49 + Edge PC 32', () => {
    expect(EQUIPMENT_PANELS).toHaveLength(81)
    expect(EQUIPMENT_PANELS.filter((p) => p.kind === 'network-panel')).toHaveLength(49)
    expect(EQUIPMENT_PANELS.filter((p) => p.kind === 'edge-pc')).toHaveLength(32)
    expect([...CABINET_TYPE_IDS]).toEqual(['PNL', 'EDGE'])
  })

  it('캐비닛은 스스로 다른 캐비닛에 물리지 않는다', () => {
    const nested = YARD_EQUIPMENT.filter(
      (e) => (e.typeId === 'PNL' || e.typeId === 'EDGE') && e.panelId
    )
    expect(nested.map((e) => e.id)).toEqual([])
  })

  it('panelId 는 실재하는 캐비닛을 가리키고, 공장이 같다', () => {
    const bad = YARD_EQUIPMENT.filter((e) => {
      if (!e.panelId) return false
      const host = equipmentPanelOf(e.panelId)
      return host === null || host.factory !== e.factory
    })
    expect(bad.map((e) => `${e.id}→${e.panelId}`)).toEqual([])
  })

  it('소속 설비 합이 panelId 를 가진 설비 수와 같다 — 새는 설비가 없다', () => {
    const hosted = YARD_EQUIPMENT.filter((e) => e.panelId).length
    const summed = EQUIPMENT_PANELS.reduce((sum, p) => sum + p.memberIds.length, 0)
    expect(summed).toBe(hosted)
    expect(hosted).toBe(674) // 라이다 337 + 틸팅 337
  })

  it('캐비닛의 베이와 소속 설비의 베이는 다를 수 있다 — 담당 범위는 memberBays 가 말한다', () => {
    const spanning = EQUIPMENT_PANELS.filter((p) => p.memberBays.length > 1)
    expect(spanning.length).toBeGreaterThan(0)
    const pnlD1 = equipmentPanelOf('PNL-D1')!
    expect(pnlD1.memberBays.length).toBeGreaterThan(1)
    expect(pnlD1.memberBays).toContain(pnlD1.bay === '2' ? '1' : pnlD1.bay)
  })

  it('빈 캐비닛 16대 — 도면에 있으나 아직 물린 설비가 없다(집계에서 0으로 서야 한다)', () => {
    const empty = EQUIPMENT_PANELS.filter((p) => p.memberIds.length === 0)
    expect(empty).toHaveLength(16)
    expect(panelImpact(empty[0].id)).toEqual({ total: 0, byType: {}, lidarPairs: 0 })
  })

  it('영향 집계 — 라이다 대수와 페어 수가 같다(1라이다 = 1페어)', () => {
    const panel = EQUIPMENT_PANELS.find((p) => (p.memberCountByType.LIDAR ?? 0) > 0)!
    const impact = panelImpact(panel.id)
    expect(impact.total).toBe(panel.memberIds.length)
    expect(impact.lidarPairs).toBe(panel.memberCountByType.LIDAR)
    expect(impact.byType.TILT).toBe(impact.lidarPairs)
  })

  it('equipmentOfPanel 은 memberIds 와 같은 목록을 준다', () => {
    const panel = EQUIPMENT_PANELS.find((p) => p.memberIds.length > 0)!
    expect(equipmentOfPanel(panel.id).map((e) => e.id)).toEqual([...panel.memberIds])
  })

  it('공장별 캐비닛 — 소속 설비도 같은 공장이다', () => {
    const panels = panelsOfFactory('PBS')
    expect(panels.length).toBeGreaterThan(0)
    for (const p of panels) {
      for (const id of p.memberIds) expect(yardEquipmentOf(id)?.factory).toBe('PBS')
    }
  })

  it('모르는 캐비닛ID 는 null — 없는 패널을 지어내지 않는다', () => {
    expect(equipmentPanelOf('PNL-없음')).toBeNull()
    expect(equipmentOfPanel('PNL-없음')).toEqual([])
  })
})
