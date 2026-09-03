import { describe, expect, it } from 'vitest'
import { paintingFactoryTone } from '../equipmentInventory'

/*
 * 공장 카드가 입는 처지 — **접힌 카드와 펴 본 목록이 같은 말을 하는가**.
 *
 * 목록 줄은 끊김과 흔들림을 갈라 그린다(붉은 테 / 앰버 테). 카드 테두리가 그 둘을
 * 한 색으로 뭉개면, 카드를 펴는 순간 화면이 말을 바꾸는 셈이 된다(W6-6 이월).
 */

const none = { faults: 0, issues: 0, transferredDown: 0, transferredIssues: 0 }

describe('도장 공장 카드의 상태 톤', () => {
  it('아무 일 없으면 색을 얻지 않는다 — 모두가 색을 얻으면 색이 가리키는 것이 없다', () => {
    expect(paintingFactoryTone(none)).toBeNull()
  })

  it('SCADA 고장(FAULT)은 이상이다', () => {
    expect(paintingFactoryTone({ ...none, faults: 1, issues: 1 })).toBe('error')
  })

  it('이관 설비가 끊겼어도 이상이다 — 두 원천이 같은 계급을 쓴다', () => {
    expect(paintingFactoryTone({ ...none, transferredDown: 1, transferredIssues: 1 })).toBe('error')
  })

  it('링크만 흔들리면 주의 — 빨강은 끊김 전용이다', () => {
    expect(paintingFactoryTone({ ...none, issues: 2 })).toBe('warning')
    expect(paintingFactoryTone({ ...none, transferredIssues: 3 })).toBe('warning')
  })

  it('끊김과 흔들림이 함께면 더 무거운 쪽이 이긴다', () => {
    expect(paintingFactoryTone({ faults: 1, issues: 4, transferredDown: 0, transferredIssues: 2 })).toBe(
      'error'
    )
  })
})
