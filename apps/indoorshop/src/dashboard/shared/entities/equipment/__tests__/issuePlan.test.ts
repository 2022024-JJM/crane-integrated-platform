import { describe, expect, it } from 'vitest'
import { YARD_EQUIPMENT, equipmentOfTypes } from '../index'
import { equipmentLinkOf, plannedIssueOf, plannedIssues } from '../statusMock'
import { factorySlugOf } from '../../../lib/factorySlugs'

/*
 * **아픈 설비는 드물다** (R27).
 *
 * 이 검사가 지키는 것은 숫자 하나가 아니라 화면의 인상이다. 확률로 굴리던 시절에는
 * 841대 중 백 대 가까이가 아파서, 어느 공장을 열어도 "맨날 아픈 공장"이었다 — 그러면
 * 진짜 이상이 와도 눈에 띄지 않는다. 반대로 전부 정상이면 알람 레일도 이상 정렬도
 * 보여 줄 것이 없다. 그래서 **상한과 하한을 함께** 못 박는다.
 */

/** 공정 키 — 슬러그 앞자리(가공 설비는 조립 화면에 서므로 조립과 한 몫) */
function zoneOf(factory: string): string {
  const head = (factorySlugOf(factory) ?? '').split('-')[0]
  return head === 'fab' ? 'asm' : head
}

const ISSUE_ZONES = ['asm', 'ofit', 'pnt'] as const

/** 링크 축이 정상이 아닌 설비 — 화면의 '점검 필요' 뱃지가 세는 것과 같은 축 */
const troubled = YARD_EQUIPMENT.filter((e) => equipmentLinkOf(e) !== 'online')

describe('설비 이상 분포 — 상한', () => {
  it('전체 이상은 한 자릿수다 — 이상이 흔하면 이상이 아니게 된다', () => {
    expect(troubled.length).toBeLessThan(10)
  })

  it('정상이 97% 이상이다', () => {
    const normal = YARD_EQUIPMENT.length - troubled.length
    expect(normal / YARD_EQUIPMENT.length).toBeGreaterThanOrEqual(0.97)
  })

  it('오류 2~3대 · 통신 끊김 3~4대 — 정해 둔 몫 그대로', () => {
    const plan = [...plannedIssues().values()]
    const errors = plan.filter((v) => v === 'error').length
    const offline = plan.filter((v) => v === 'offline').length
    expect(errors).toBeGreaterThanOrEqual(2)
    expect(errors).toBeLessThanOrEqual(3)
    expect(offline).toBeGreaterThanOrEqual(3)
    expect(offline).toBeLessThanOrEqual(4)
  })

  it('한 공장이 이상을 독차지하지 않는다 — 공장 하나에 최대 두 대', () => {
    const byFactory = new Map<string, number>()
    for (const e of troubled) byFactory.set(e.factory, (byFactory.get(e.factory) ?? 0) + 1)
    for (const [factory, count] of byFactory) {
      expect(count, `${factory} 에 ${count}대`).toBeLessThanOrEqual(2)
    }
  })
})

describe('설비 이상 분포 — 하한(시연 이야기 보존)', () => {
  it.each(ISSUE_ZONES)('%s 공정에 최소 한 건은 남는다 — 알람 레일·이상 정렬이 보여 줄 것', (zone) => {
    const inZone = troubled.filter((e) => zoneOf(e.factory) === zone)
    expect(inZone.length).toBeGreaterThanOrEqual(1)
  })

  it('오류와 통신 끊김이 둘 다 있다 — 두 계급이 화면에서 갈려 보여야 한다', () => {
    const kinds = new Set(troubled.map((e) => equipmentLinkOf(e)))
    expect(kinds).toContain('error')
    expect(kinds).toContain('offline')
  })
})

describe('설비 이상 분포 — 한 명단, 결정론', () => {
  it('명단에 없으면 정상이다 — 화면이 따로 주사위를 굴리지 않는다', () => {
    for (const equipment of troubled) {
      expect(plannedIssueOf(equipment.id), equipment.id).not.toBeNull()
    }
    expect(troubled.length).toBe(plannedIssues().size)
  })

  it('몇 번을 물어도 같은 답이다', () => {
    const first = YARD_EQUIPMENT.map((e) => equipmentLinkOf(e)).join(',')
    const second = YARD_EQUIPMENT.map((e) => equipmentLinkOf(e)).join(',')
    expect(second).toBe(first)
  })

  it('캐비닛은 제 소속의 이상을 제 이상으로 세지 않는다 — 한 사실이 두 대가 되지 않게', () => {
    const panels = equipmentOfTypes(['PNL']).filter((p) => plannedIssueOf(p.id) === null)
    for (const panel of panels) {
      expect(equipmentLinkOf(panel), panel.id).toBe('online')
    }
  })
})
