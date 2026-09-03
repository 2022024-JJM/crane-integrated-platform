import { describe, expect, it } from 'vitest'
import { YARD_EQUIPMENT } from '../shared/entities/equipment'
import {
  assemblyMapFactoryNames,
  collectionRowsOf,
  equipmentSectionsOf,
  factoryStatusHref,
} from '../processes/assembly/lib/mapEntry'
import {
  outfittingCollectionRows,
  outfittingEquipmentSections,
  outfittingFactoryStatusHref,
  outfittingFactoryNames,
} from '../processes/outfitting/lib/equipmentStatus'

/**
 * 조립·의장 우측 패널의 **구성**이 실제로 같은 문법인가 (W6-5).
 *
 * 두 화면을 각각 눈으로 보고 "비슷하네" 하고 넘어가면, 한쪽 구획 순서가 바뀌거나 한쪽만
 * 접힘 규칙이 달라져도 아무도 모른다. 구성 규칙을 컴포넌트 밖으로 꺼내 둔 이유가 이것이고,
 * 여기서 두 공정을 나란히 놓고 비교한다. (공정을 가로지르는 검사라 어느 레이어에도 속하지
 * 않는 `src/__tests__` 에 둔다.)
 */
/** 관측 먼저, 수집·네트워크 나중 — 두 공정이 공유하는 순서 */
const EXPECTED_ORDER = ['LIDAR', 'TILT', 'EDGE', 'PNL']

describe('설비 상태 단의 구획 — 두 공정이 같은 순서·같은 규칙', () => {
  it('조립: 구획이 관측 → 수집·네트워크 순으로 선다', () => {
    for (const factory of assemblyMapFactoryNames()) {
      const order = equipmentSectionsOf(factory).map((s) => s.typeId)
      expect(order).toEqual(EXPECTED_ORDER.filter((id) => order.includes(id as never)))
    }
  })

  it('의장: 같은 순서를 쓴다', () => {
    for (const factory of outfittingFactoryNames()) {
      const order = outfittingEquipmentSections(factory).map((s) => s.typeId)
      expect(order).toEqual(EXPECTED_ORDER.filter((id) => order.includes(id as never)))
    }
  })

  it('두 공정 모두 라이다만 베이별로 나뉘고 틸팅만 접힌다', () => {
    const check = (sections: { typeId: string; collapsible: boolean; groups?: unknown }[]) => {
      for (const section of sections) {
        expect(section.collapsible).toBe(section.typeId === 'TILT')
        expect(section.groups !== undefined).toBe(section.typeId === 'LIDAR')
      }
    }
    check(equipmentSectionsOf('PBS'))
    check(outfittingEquipmentSections('POS 1공장'))
  })

  it('구획 대수가 설비 엔티티의 실제 대수와 같다 — 화면이 세지 않고 데이터가 센다', () => {
    const countOf = (factory: string, typeId: string) =>
      YARD_EQUIPMENT.filter((e) => e.factory === factory && e.typeId === typeId).length
    for (const factory of ['PBS', 'GBS', 'CAS']) {
      for (const section of equipmentSectionsOf(factory)) {
        expect(section.count).toBe(countOf(factory, section.typeId))
      }
    }
    for (const factory of outfittingFactoryNames()) {
      for (const section of outfittingEquipmentSections(factory)) {
        expect(section.count).toBe(countOf(factory, section.typeId))
      }
    }
  })

  it('라이다 베이 묶음의 ID 합이 그 구획 대수와 같다 — 베이를 나누다 흘리지 않는다', () => {
    for (const sections of [
      equipmentSectionsOf('PBS'),
      outfittingEquipmentSections('POS 1공장'),
    ]) {
      const lidar = sections.find((s) => s.typeId === 'LIDAR')!
      const ids = lidar.groups!.flatMap((g) => g.ids)
      expect(ids).toHaveLength(lidar.count)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('베이 묶음은 번호 순이다 — 두 화면에서 같은 차례로 읽힌다', () => {
    for (const sections of [
      equipmentSectionsOf('PBS'),
      outfittingEquipmentSections('POS 1공장'),
    ]) {
      const bays = sections.find((s) => s.typeId === 'LIDAR')!.groups!.map((g) => g.bay)
      expect(bays).toEqual([...bays].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
    }
  })

  it('설비가 없는 공장은 구획을 만들지 않는다 — 빈 제목만 남는 자리를 두지 않는다', () => {
    expect(equipmentSectionsOf('없는공장')).toEqual([])
    expect(outfittingEquipmentSections('없는공장')).toEqual([])
  })
})

describe('수집 현황 — 두 공정이 같은 세 줄과 나가는 문', () => {
  it('조립: 감지·오늘 판별·최근 수집 세 줄', () => {
    const rows = collectionRowsOf({
      bays: [{ projNo: 'H1234' }, {}, { projNo: 'H1235' }],
      todayCount: 4,
      lastScanAt: '2026-09-03T14:20:00',
    })
    expect(rows.map((r) => r.value)).toEqual(['2', '4', '14:20'])
    expect(rows).toHaveLength(3)
  })

  it('조립: 최근 수집이 없으면 대시 — 0 으로 속이지 않는다', () => {
    const rows = collectionRowsOf({ bays: [], todayCount: 0 })
    expect(rows.at(-1)!.value).toBe('—')
  })

  it('의장: 같은 자리에 같은 성격의 세 줄', () => {
    const rows = outfittingCollectionRows({
      blockTotal: 10,
      inProgress: 3,
      completed: 2,
      lastScanAt: '15:48',
    })
    expect(rows).toHaveLength(3)
    expect(rows[0].value).toBe('5/10')
    expect(rows[1].value).toBe('2')
    expect(rows[2].value).toBe('15:48')
  })

  it('두 공정의 세 줄이 같은 순서의 같은 질문이다', () => {
    const tail = (key: string) => key.split('.').at(-1)
    const asm = collectionRowsOf({ bays: [], todayCount: 0 }).map((r) => tail(r.labelKey))
    const out = outfittingCollectionRows({ blockTotal: 0, inProgress: 0, completed: 0 }).map((r) =>
      tail(r.labelKey)
    )
    expect(asm[0]).toBe('detected')
    expect(out[0]).toBe('detected')
    expect(asm[2]).toBe('lastScan')
    expect(out[2]).toBe('lastScan')
  })
})

describe('공장 현황으로 나가는 경로', () => {
  it('조립 공장은 자기 현황 화면으로 간다', () => {
    expect(factoryStatusHref('PBS')).toBe('/indoorshop/zones/assembly/asm-pbs')
  })

  it('조립 API 에 없는 CAS·PAS 는 문을 내지 않는다 — 안 열리는 문을 두지 않는다', () => {
    expect(factoryStatusHref('CAS')).toBeNull()
    expect(factoryStatusHref('PAS')).toBeNull()
  })

  it('의장 7공장은 모두 자기 현황 화면으로 간다', () => {
    for (const factory of outfittingFactoryNames()) {
      expect(outfittingFactoryStatusHref(factory)).toMatch(/^\/indoorshop\/zones\/outfitting\/[a-z0-9-]+$/)
    }
    expect(outfittingFactoryStatusHref('없는공장')).toBeNull()
  })
})
