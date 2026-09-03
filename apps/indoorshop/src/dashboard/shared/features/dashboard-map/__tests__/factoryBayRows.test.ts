import { describe, expect, it } from 'vitest'
import { loadYardParcels } from '../../../entities/yard-parcels'
import { summarizeBay } from '../lib/bayDetail'
import {
  BAY_DETAIL_FIELDS,
  FACTORY_BAY_ROW_FIELDS,
  factoryBayRows,
} from '../lib/factoryBayRows'
import { ko } from '../../../lib/i18n/locales/ko'
import { en } from '../../../lib/i18n/locales/en'

/*
 * 계층 정합 계약 (R14) — 공장 상세의 베이 행은 베이 상세의 **축약판**이다.
 * 행의 항목 집합 ⊆ 상세 항목 집합, 어휘(i18n 키)·수치 원천(summarizeBay) 동일.
 * 여기가 깨지면 공장→베이가 "줌 단계"가 아니라 서로 다른 화면 둘이 된다.
 */
describe('공장 상세 베이 행 ⊆ 베이 상세 (R14)', () => {
  it('행의 필드 집합은 상세 필드 집합의 부분집합이다', () => {
    const detail = new Set<string>(BAY_DETAIL_FIELDS)
    for (const field of FACTORY_BAY_ROW_FIELDS) {
      expect(detail.has(field), `베이 상세에 없는 필드가 행에 있다: ${field}`).toBe(true)
    }
  })

  it('행이 쓰는 어휘는 상세와 같은 i18n 키다 — 두 로케일 모두', () => {
    for (const field of FACTORY_BAY_ROW_FIELDS) {
      /* BayDetailCard 가 쓰는 키가 dashboard.map.{field} — 행도 같은 키를 쓴다 */
      expect(ko.dashboard.map[field], `ko 에 dashboard.map.${field} 가 없다`).toBeTruthy()
      expect(en.dashboard.map[field], `en 에 dashboard.map.${field} 가 없다`).toBeTruthy()
    }
  })

  it('행의 수치는 베이 상세와 같은 함수(summarizeBay)에서 나온다 — 값이 어긋날 수 없다', async () => {
    const parcels = await loadYardParcels()
    const factories = [...new Set(parcels.bays.map((b) => b.factory))]
    expect(factories.length).toBeGreaterThan(0)
    for (const factory of factories) {
      for (const row of factoryBayRows(parcels, factory)) {
        expect(row).toEqual(summarizeBay(parcels, row.id))
      }
    }
  })

  it('행은 그 공장의 베이 전부를, 매핑 순서 그대로 담는다 — 빠지는 베이가 없다', async () => {
    const parcels = await loadYardParcels()
    const factory = parcels.bays[0].factory
    const expected = parcels.bays.filter((b) => b.factory === factory).map((b) => b.id)
    expect(factoryBayRows(parcels, factory).map((r) => r.id)).toEqual(expected)
  })
})
