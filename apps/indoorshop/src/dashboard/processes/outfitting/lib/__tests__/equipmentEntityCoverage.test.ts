import { describe, expect, it } from 'vitest'
import { YARD_EQUIPMENT } from '../../../../shared/entities/equipment'
import { OUTFITTING_DEVICE_KINDS } from '../../model/equipment'
import { deviceSummaryOf, outfittingDevices, outfittingFactoryNames } from '../equipmentStatus'

/**
 * 의장 설비 상태 화면이 **이관된 실데이터 위에 서는가**.
 *
 * 이 화면은 설비 엔티티에 그 공장 행이 없을 때만 목업 자리(placeholder)로 떨어지도록
 * 짜여 있다. 260903 교체판 도면 이관이 의장 7공장까지 닿았으므로, 이제 그 폴백은 한 곳도
 * 서지 않아야 한다 — 다시 서면 이관이 되돌아갔거나 공장 이름 체계가 어긋난 것이고,
 * 화면은 조용히 가짜 대수를 보여 주게 된다. 그래서 여기서 못 박는다.
 */
describe('의장 설비 상태 — 이관 데이터 소비', () => {
  const factories = outfittingFactoryNames()

  it('의장 7공장 전부 설비 엔티티에 행이 있다', () => {
    const missing = factories.filter(
      (f) => !YARD_EQUIPMENT.some((e) => e.factory === f)
    )
    expect(missing).toEqual([])
    expect(factories).toHaveLength(7)
  })

  it('목업 자리로 떨어지는 공장이 없다 — 대수·베이가 전부 실데이터다', () => {
    const fallback = factories.filter((f) => deviceSummaryOf(f).placeholder)
    expect(fallback).toEqual([])
  })

  it('공장별 대수가 설비 엔티티의 해당 종류 대수와 정확히 같다', () => {
    const kinds = new Set<string>(OUTFITTING_DEVICE_KINDS)
    for (const factory of factories) {
      const expected = YARD_EQUIPMENT.filter(
        (e) => e.factory === factory && kinds.has(e.typeId)
      ).length
      expect(outfittingDevices(factory)).toHaveLength(expected)
    }
  })

  it('설비 ID 가 도면 체계를 따른다 — 목업이 지어낸 이름이 섞이지 않는다', () => {
    const known = new Set(YARD_EQUIPMENT.map((e) => e.id))
    for (const factory of factories) {
      const strangers = outfittingDevices(factory).filter((d) => !known.has(d.id))
      expect(strangers.map((d) => d.id)).toEqual([])
    }
  })

  it('라이다와 틸팅이 공장마다 같은 대수로 선다 (도면 페어)', () => {
    for (const factory of factories) {
      const { byKind } = deviceSummaryOf(factory)
      expect(byKind.TILT.total).toBe(byKind.LIDAR.total)
    }
  })
})
