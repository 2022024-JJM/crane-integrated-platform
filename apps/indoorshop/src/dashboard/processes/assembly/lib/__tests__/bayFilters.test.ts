import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BAY_FILTER,
  bayPassesFilter,
  isAbnormalBay,
  isFilterActive,
  type BayFilterInput,
} from '../bayFilters'

function bay(overrides: Partial<BayFilterInput> = {}): BayFilterInput {
  return { sensorStatus: 'online', workState: 'working', stage: 'FR', ...overrides }
}

describe('bayPassesFilter — 공장 뷰 정반 필터 (FR-9)', () => {
  it('기본 필터는 아무것도 거르지 않는다', () => {
    expect(isFilterActive(DEFAULT_BAY_FILTER)).toBe(false)
    expect(bayPassesFilter(bay(), DEFAULT_BAY_FILTER)).toBe(true)
    expect(bayPassesFilter(bay({ sensorStatus: null, workState: 'noData' }), DEFAULT_BAY_FILTER)).toBe(true)
  })

  it('이상만 보기 — 오류·오프라인·미수신만 남는다', () => {
    const filter = { ...DEFAULT_BAY_FILTER, abnormalOnly: true }
    expect(bayPassesFilter(bay({ sensorStatus: 'error' }), filter)).toBe(true)
    expect(bayPassesFilter(bay({ sensorStatus: 'offline' }), filter)).toBe(true)
    expect(bayPassesFilter(bay({ sensorStatus: null }), filter)).toBe(true)
    expect(bayPassesFilter(bay({ sensorStatus: 'online' }), filter)).toBe(false)
  })

  it('미점유 숨기기 — idle 만 가라앉고, noData(미수신)는 점유 필터로 감추지 않는다 (FR-2 구분)', () => {
    const filter = { ...DEFAULT_BAY_FILTER, hideUnoccupied: true }
    expect(bayPassesFilter(bay({ workState: 'idle' }), filter)).toBe(false)
    expect(bayPassesFilter(bay({ workState: 'working' }), filter)).toBe(true)
    expect(bayPassesFilter(bay({ workState: 'noData', sensorStatus: null }), filter)).toBe(true)
  })

  it('공정 단계 필터 — 동일 stage 만 남고, stage 없는 정반은 걸린다', () => {
    const filter = { ...DEFAULT_BAY_FILTER, stage: 'FR' }
    expect(bayPassesFilter(bay({ stage: 'FR' }), filter)).toBe(true)
    expect(bayPassesFilter(bay({ stage: 'SB' }), filter)).toBe(false)
    expect(bayPassesFilter(bay({ stage: null }), filter)).toBe(false)
  })

  it('조건은 AND — 하나라도 어긋나면 걸린다', () => {
    const filter = { abnormalOnly: true, hideUnoccupied: true, stage: 'FR' }
    expect(isFilterActive(filter)).toBe(true)
    expect(bayPassesFilter(bay({ sensorStatus: 'error', workState: 'working', stage: 'FR' }), filter)).toBe(true)
    expect(bayPassesFilter(bay({ sensorStatus: 'error', workState: 'idle', stage: 'FR' }), filter)).toBe(false)
    expect(bayPassesFilter(bay({ sensorStatus: 'error', workState: 'working', stage: 'SB' }), filter)).toBe(false)
  })
})

describe('isAbnormalBay — 이상 정반 판정', () => {
  it('오류·오프라인·미수신(null)이 이상이다', () => {
    expect(isAbnormalBay('error')).toBe(true)
    expect(isAbnormalBay('offline')).toBe(true)
    expect(isAbnormalBay(null)).toBe(true)
    expect(isAbnormalBay('online')).toBe(false)
  })
})
