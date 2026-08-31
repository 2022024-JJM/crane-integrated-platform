import { describe, expect, it } from 'vitest'
import {
  emphasisFor,
  EMPHASIS_GEOMETRY_OPACITY,
  EMPHASIS_LABEL_OPACITY,
} from '../bayEmphasis'

describe('emphasisFor — 선택/동일 공정/무관 강조 계층 (FR-5)', () => {
  const selection = { bayId: 'b1', stage: 'FR' }

  it('선택이 없으면 전부 neutral — 아무도 가라앉지 않는다', () => {
    expect(emphasisFor('b1', 'FR', null)).toBe('neutral')
    expect(emphasisFor('b2', null, null)).toBe('neutral')
  })

  it('선택 대상은 selected', () => {
    expect(emphasisFor('b1', 'FR', selection)).toBe('selected')
  })

  it('동일 stage 는 sameStage, 다른 stage 는 unrelated', () => {
    expect(emphasisFor('b2', 'FR', selection)).toBe('sameStage')
    expect(emphasisFor('b3', 'SB', selection)).toBe('unrelated')
  })

  it('stage 를 모르는 쪽이 있으면 sameStage 로 판정하지 않는다', () => {
    expect(emphasisFor('b2', null, selection)).toBe('unrelated')
    expect(emphasisFor('b2', 'FR', { bayId: 'b1', stage: null })).toBe('unrelated')
  })
})

describe('강조 불투명도 — PRD FR-5 표의 범위를 지킨다', () => {
  it('형상: 선택 100% · 동일 공정 45~60% · 무관 10~20%', () => {
    expect(EMPHASIS_GEOMETRY_OPACITY.selected).toBe(1)
    expect(EMPHASIS_GEOMETRY_OPACITY.sameStage).toBeGreaterThanOrEqual(0.45)
    expect(EMPHASIS_GEOMETRY_OPACITY.sameStage).toBeLessThanOrEqual(0.6)
    expect(EMPHASIS_GEOMETRY_OPACITY.unrelated).toBeGreaterThanOrEqual(0.1)
    expect(EMPHASIS_GEOMETRY_OPACITY.unrelated).toBeLessThanOrEqual(0.2)
  })

  it('라벨은 무관 대상도 상호작용 가능할 만큼 남긴다', () => {
    expect(EMPHASIS_LABEL_OPACITY.unrelated).toBeGreaterThan(EMPHASIS_GEOMETRY_OPACITY.unrelated)
  })
})
