import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT_FOCUS_PARAM,
  equipmentFocusOf,
  foldExceptFocus,
  withEquipmentFocus,
} from '../equipmentFocus'
import { parseDrilldown } from '../drilldownUrl'

/*
 * 설비 딥링크 (링크 스모크 ⑥) — 알람 당사자가 도착 화면에 서는지의 계약.
 * 여기가 깨지면 "여기 문제가 있다"고 불러 놓고 그 자리에 아무것도 안 보여 준다.
 */
describe('equipmentFocusOf · withEquipmentFocus', () => {
  it('링크가 당사자를 싣고, 도착 화면이 그것을 읽는다', () => {
    const href = withEquipmentFocus('/indoorshop/zones/assembly?factory=asm-pbs', 'PT-N11')
    expect(equipmentFocusOf(href.split('?')[1])).toBe('PT-N11')
  })

  it('드릴다운 값과 공존한다 — 서로의 키를 건드리지 않는다', () => {
    const href = withEquipmentFocus('/indoorshop/zones/assembly?factory=asm-pbs&bay=5BAY', 'LD-P10')
    const query = href.split('?')[1]
    expect(parseDrilldown(query).factory).toBe('PBS')
    expect(parseDrilldown(query).bay).toBe('PBS#5BAY')
    expect(equipmentFocusOf(query)).toBe('LD-P10')
  })

  it('쿼리가 없던 경로에는 `?` 로 붙는다', () => {
    expect(withEquipmentFocus('/indoorshop/zones/assembly', 'X')).toBe(`/indoorshop/zones/assembly?${EQUIPMENT_FOCUS_PARAM}=X`)
  })

  it('한글·공백이 든 id 도 주소가 깨지지 않는다', () => {
    const href = withEquipmentFocus('/z', '틸팅 1')
    expect(equipmentFocusOf(href.split('?')[1])).toBe('틸팅 1')
  })

  it('없거나 빈 값이면 null — 초점 없음과 빈 문자열을 구분한다', () => {
    expect(equipmentFocusOf('')).toBeNull()
    expect(equipmentFocusOf(`${EQUIPMENT_FOCUS_PARAM}=`)).toBeNull()
    expect(equipmentFocusOf(`${EQUIPMENT_FOCUS_PARAM}=%20`)).toBeNull()
  })
})

describe('foldExceptFocus — 접힘의 예외는 당사자 하나뿐', () => {
  const rows = [
    { id: 'LD-1', fold: false },
    { id: 'PT-1', fold: true },
    { id: 'PT-2', fold: true },
  ]
  const fold = (r: (typeof rows)[number]) => r.fold
  const idOf = (r: (typeof rows)[number]) => r.id

  it('초점이 없으면 화면 규칙 그대로 접는다', () => {
    expect(foldExceptFocus(rows, fold, idOf, null).map(idOf)).toEqual(['LD-1'])
  })

  it('초점 대상만 펴진다 — 접힘을 통째로 끄지 않는다', () => {
    expect(foldExceptFocus(rows, fold, idOf, 'PT-2').map(idOf)).toEqual(['LD-1', 'PT-2'])
  })

  it('접히지 않는 설비가 초점이어도 목록이 달라지지 않는다', () => {
    expect(foldExceptFocus(rows, fold, idOf, 'LD-1').map(idOf)).toEqual(['LD-1'])
  })

  it('없는 id 가 와도 화면은 선다 — 규칙 그대로', () => {
    expect(foldExceptFocus(rows, fold, idOf, '없음').map(idOf)).toEqual(['LD-1'])
  })
})
