import { describe, expect, it } from 'vitest'
import { zoneJumpHref } from '../lib/zoneJump'
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
