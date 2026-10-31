import { describe, expect, it } from 'vitest'
import {
  factoryPerformanceHref,
  isBaylessProcess,
  paintingBayBlocksJumpHref,
  zoneBayJumpHref,
  zoneJumpHref,
  zoneTabJumpHref,
} from '../lib/zoneJump'
import { parseDrilldown } from '../../../lib/drilldownUrl'

/*
 * '/' → 공정 화면 점프 버튼의 주소 계약. 드릴다운 URL 계약(`?factory=`)만 쓴다 —
 * 옛 `?shop=` 철자나 다른 문법이 여기로 새로 들어오면 안 된다.
 */
describe('zoneJumpHref — 공정 화면으로 넘어가는 문', () => {
  it('맵 화면이 있는 세 공정은 그 공장을 연 주소를 낸다 — 값은 안정 슬러그(F-30)', () => {
    expect(zoneJumpHref('조립', 'GBS')).toBe('/indoorshop/zones/assembly?factory=asm-gbs')
    expect(zoneJumpHref('의장', 'POS 1공장')).toBe('/indoorshop/zones/outfitting?factory=ofit-pos1')
    expect(zoneJumpHref('도장', '1DOCK 도장공장')).toBe('/indoorshop/zones/painting?factory=pnt-1dock')
    /* 표에 없는 이름은 이름 그대로 실린다 — 계약 파서가 되읽는다(호환) */
    const unknown = zoneJumpHref('조립', '새공장')!
    expect(parseDrilldown(unknown.split('?')[1]).factory).toBe('새공장')
  })

  it('가공은 맵 화면이 없다 — 문을 만들지 않는다', () => {
    expect(zoneJumpHref('가공', 'CTS')).toBeNull()
  })

  it('공정을 모르는 공장도 문이 없다', () => {
    expect(zoneJumpHref(null, 'X')).toBeNull()
    expect(zoneJumpHref('물류', 'X')).toBeNull()
  })

  it('옛 철자(?shop=)를 쓰지 않는다', () => {
    expect(zoneJumpHref('조립', 'GBS')).not.toContain('shop=')
  })
})

describe('zoneBayJumpHref — 베이까지 실은 공정 화면 주소', () => {
  it('공장과 베이를 함께 싣는다 — 도착 화면이 그 베이를 고른 채로 선다', () => {
    const href = zoneBayJumpHref('도장', '느태 도장공장', '느태 도장공장#NP1')!
    expect(href.startsWith('/indoorshop/zones/painting?')).toBe(true)
    const state = parseDrilldown(href.split('?')[1])
    expect(state.factory).toBe('느태 도장공장')
    expect(state.bay).toBe('느태 도장공장#NP1')
  })

  it('맵 화면이 없는 공정은 null', () => {
    expect(zoneBayJumpHref('가공', 'CTS', 'CTS#1')).toBeNull()
  })
})

describe('zoneTabJumpHref — 공장 카드의 3D·실적 문', () => {
  it('조립·의장은 공장 화면을 그 축(탭)으로 연다', () => {
    expect(zoneTabJumpHref('조립', 'PBS', 'viewer')).toBe('/indoorshop/zones/assembly?factory=asm-pbs&tab=viewer')
    expect(zoneTabJumpHref('의장', 'POS 1공장', 'blocks')).toBe('/indoorshop/zones/outfitting?factory=ofit-pos1&tab=blocks')
  })

  it('그 축이 없는 공정(도장·가공)은 null — 문을 세우지 않는다', () => {
    expect(zoneTabJumpHref('도장', '느태 도장공장', 'viewer')).toBeNull()
    expect(zoneTabJumpHref('가공', 'CTS', 'blocks')).toBeNull()
    expect(zoneTabJumpHref(null, 'X', 'viewer')).toBeNull()
  })
})

describe('paintingBayBlocksJumpHref — 도장 베이 카드의 실적 문', () => {
  it('도장 베이는 그 베이의 도장 화면을 블록·실적 축으로 연다', () => {
    const href = paintingBayBlocksJumpHref('도장', '1DOCK 도장공장', '1DOCK 도장공장#3')!
    expect(href.startsWith('/indoorshop/zones/painting?')).toBe(true)
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('tab')).toBe('blocks')
    expect(params.get('factory')).toBe('pnt-1dock')
  })

  it('도장이 아니면 문을 내지 않는다 — 조립·의장 베이는 bayTabHref 가 맡는다', () => {
    expect(paintingBayBlocksJumpHref('조립', 'GBS', 'GBS#1')).toBeNull()
    expect(paintingBayBlocksJumpHref(null, 'GBS', 'GBS#1')).toBeNull()
  })
})

describe('가공 공장 — 베이 없이 공장까지만, 공장 카드의 실적 문은 가공 화면', () => {
  it('가공만 베이 단위로 보지 않는다', () => {
    expect(isBaylessProcess('가공')).toBe(true)
    expect(isBaylessProcess('조립')).toBe(false)
    expect(isBaylessProcess(null)).toBe(false)
  })

  it('실적 문 — 가공은 가공 화면, 조립·의장은 블록·실적 탭, 도장은 없다', () => {
    expect(factoryPerformanceHref('가공', 'CAS')).toBe('/indoorshop/zones/fabrication')
    expect(factoryPerformanceHref('조립', 'GBS')).toBe(zoneTabJumpHref('조립', 'GBS', 'blocks'))
    expect(factoryPerformanceHref('도장', 'POS')).toBeNull()
  })
})
