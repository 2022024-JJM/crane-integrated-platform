import { describe, expect, it } from 'vitest'
import { resolveZoneFactoryId, zoneEntryBay } from '../zoneEntryFactory'

/*
 * 공정존 대문의 공장 선택 규칙 (R22) — 세 공정이 같은 계단을 쓴다.
 * 여기가 깨지면 총괄에서 '공정 화면으로' 눌렀을 때 엉뚱한 공장이 열린다.
 */
const FACTORIES = [
  { id: 'asm-pbs', name: 'PBS' },
  { id: 'asm-gbs', name: 'GBS' },
]

describe('resolveZoneFactoryId', () => {
  it('경로의 공장이 가장 세다 — 기존 링크·북마크가 그대로 산다', () => {
    expect(resolveZoneFactoryId(FACTORIES, { factoryId: 'asm-gbs', search: '?factory=PBS' })).toBe(
      'asm-gbs'
    )
  })

  it('경로에 없으면 `?factory=` 를 따른다 — 총괄 점프의 착지', () => {
    expect(resolveZoneFactoryId(FACTORIES, { search: '?factory=GBS' })).toBe('asm-gbs')
  })

  it('슬러그로 와도 같은 공장을 연다 (drilldownUrl 계약이 이름으로 되읽는다)', () => {
    expect(resolveZoneFactoryId(FACTORIES, { search: '?factory=asm-gbs' })).toBe('asm-gbs')
  })

  it('옛 철자 `?shop=` 도 읽는다 — 낡은 링크가 죽지 않게', () => {
    expect(resolveZoneFactoryId(FACTORIES, { search: '?shop=GBS' })).toBe('asm-gbs')
  })

  it('단서가 없으면 첫 공장 — 빈 화면을 세우고 "고르세요"라 하지 않는다', () => {
    expect(resolveZoneFactoryId(FACTORIES, {})).toBe('asm-pbs')
    expect(resolveZoneFactoryId(FACTORIES, { search: '' })).toBe('asm-pbs')
  })

  it('모르는 공장 이름이 와도 화면은 선다 — 첫 공장으로 물러난다', () => {
    expect(resolveZoneFactoryId(FACTORIES, { search: '?factory=%EC%97%86%EC%9D%8C' })).toBe(
      'asm-pbs'
    )
  })

  it('목록이 비면 null — 없는 공장을 지어내지 않는다', () => {
    expect(resolveZoneFactoryId([], { search: '?factory=GBS' })).toBeNull()
  })

  it('경로의 공장이 목록에 없어도 그대로 돌려준다 — 화면이 "없는 공장"을 말하게', () => {
    expect(resolveZoneFactoryId(FACTORIES, { factoryId: 'asm-none' })).toBe('asm-none')
  })
})

describe('zoneEntryBay', () => {
  it('`{공장}#{베이}` 에서 베이 조각만 낸다', () => {
    expect(zoneEntryBay('?factory=asm-gbs&bay=3BAY')).toBe('3BAY')
  })

  it('낡은 전체 id 값도 조각으로 줄인다', () => {
    expect(zoneEntryBay('?factory=GBS&bay=GBS%233BAY')).toBe('3BAY')
  })

  it('베이가 없으면 null', () => {
    expect(zoneEntryBay('?factory=asm-gbs')).toBeNull()
    expect(zoneEntryBay('')).toBeNull()
  })
})
