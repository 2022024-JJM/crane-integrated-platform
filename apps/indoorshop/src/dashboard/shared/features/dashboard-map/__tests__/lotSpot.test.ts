import { describe, expect, it } from 'vitest'
import { spotlitLot, toggleSpottedLot } from '../lib/lotSpot'

/*
 * 목록의 지번 줄 하나가 두 축(고정·미리보기)을 갖는다. 두 축이 섞이면 줄을 고정할 수
 * 없게 되므로(아래 회귀 항목), 어느 쪽이 어느 자리에 쓰이는지를 여기서 못 박는다.
 */
describe('toggleSpottedLot — 지번 줄 클릭', () => {
  it('아무것도 고정하지 않았으면 누른 것을 고정한다', () => {
    expect(toggleSpottedLot(null, 'PB7B02')).toBe('PB7B02')
  })

  it('다른 것이 고정돼 있으면 누른 쪽으로 옮긴다', () => {
    expect(toggleSpottedLot('PB7B01', 'PB7B02')).toBe('PB7B02')
  })

  it('같은 것을 다시 누르면 푼다', () => {
    expect(toggleSpottedLot('PB7B02', 'PB7B02')).toBeNull()
  })
})

describe('spotlitLot — 지도가 지금 짚을 지번', () => {
  it('손이 얹힌 것이 고정된 것을 이긴다 (훑는 동안은 미리보기가 답이다)', () => {
    expect(spotlitLot('PB7B01', 'PB7B02')).toBe('PB7B02')
  })

  it('손을 떼면 고정해 둔 자리로 되돌아온다', () => {
    expect(spotlitLot('PB7B01', null)).toBe('PB7B01')
  })

  it('둘 다 없으면 아무것도 짚지 않는다', () => {
    expect(spotlitLot(null, null)).toBeNull()
  })

  /*
   * 회귀: 카드의 줄 상태에 이 합친 값을 쓰면, 손이 얹힌 줄이 이미 눌린 것으로 보여
   * 다음 클릭이 `toggleSpottedLot` 의 해제 가지로 들어간다 — 고정이 불가능해진다.
   * 줄은 고정된 것만 보고, 합친 값은 지도만 본다.
   */
  it('합친 값을 줄 상태로 되먹이면 고정이 곧장 해제로 뒤집힌다 — 그래서 섞지 않는다', () => {
    const spotted = null
    const previewed = 'PB7B02'
    expect(toggleSpottedLot(spotlitLot(spotted, previewed), 'PB7B02')).toBeNull()
    expect(toggleSpottedLot(spotted, 'PB7B02')).toBe('PB7B02')
  })
})
