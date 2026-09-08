import { describe, expect, it } from 'vitest'
import { YARD_EQUIPMENT } from '..'
import {
  EQUIPMENT_LAYOUT_DRAWINGS,
  LAYOUT_DRAWING_REVISION,
  layoutDrawingOf,
} from '../layoutDrawings'

/**
 * 설비 배치 도면 매니페스트의 정합성.
 *
 * 매니페스트는 생성물이라 도면이 개정되면 조용히 어긋날 수 있다 — 있지도 않은 공장을
 * 가리키거나, 설비가 있는 공장의 도면이 빠지면 화면은 안 열리는 버튼을 세우거나 열 수
 * 있는 문을 감춘다. 그래서 설비 데이터와 맞대어 본다.
 */
const PAINT_FACTORIES = [
  '1DOCK 도장공장',
  '2DOCK 도장공장',
  '느태 도장공장',
  '텍사코 도장공장',
  'GPS',
]

describe('설비 배치 도면', () => {
  it('16장 — 조립 9 + 의장 7, 페이지가 1..16 로 빠짐없다', () => {
    expect(EQUIPMENT_LAYOUT_DRAWINGS).toHaveLength(16)
    expect(EQUIPMENT_LAYOUT_DRAWINGS.map((d) => d.page)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1)
    )
    expect(LAYOUT_DRAWING_REVISION).toBe('R0 · 260903')
  })

  it('공장 키·슬러그·도번이 각각 유일하다', () => {
    for (const key of ['factory', 'slug', 'drawingNo'] as const) {
      const values = EQUIPMENT_LAYOUT_DRAWINGS.map((d) => d[key])
      expect(new Set(values).size).toBe(values.length)
    }
  })

  it('도면의 공장은 모두 설비 데이터에 실재한다 — 없는 공장의 도면을 들지 않는다', () => {
    const known = new Set(YARD_EQUIPMENT.map((e) => e.factory))
    const unknown = EQUIPMENT_LAYOUT_DRAWINGS.filter((d) => !known.has(d.factory))
    expect(unknown.map((d) => d.factory)).toEqual([])
  })

  it('도장 공장을 뺀 모든 공장에 도면이 있다 — 열 수 있는 문을 감추지 않는다', () => {
    const paint = new Set(PAINT_FACTORIES)
    const missing = [...new Set(YARD_EQUIPMENT.map((e) => e.factory))]
      .filter((f) => !paint.has(f))
      .filter((f) => layoutDrawingOf(f) === null)
    expect(missing).toEqual([])
  })

  it('도장 공장은 도면이 없다 — null 이 정상이다', () => {
    for (const f of PAINT_FACTORIES) expect(layoutDrawingOf(f)).toBeNull()
  })

  it('자산 경로와 크기가 채워져 있다', () => {
    for (const d of EQUIPMENT_LAYOUT_DRAWINGS) {
      expect(d.src.endsWith(`drawings/equipment-layout/${d.slug}.webp`)).toBe(true)
      expect(d.width).toBeGreaterThan(1000)
      expect(d.height).toBeGreaterThan(700)
    }
  })
})
