import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { SearchField, type MapFocus } from '../../global-search'
import { MapFocusCard } from '../ui/BlockSearch'
import { findBlock } from '../../../entities/vessel'

/*
 * 검색 **결과 목록**의 단서 계약 — UX 감사 F-41·F-11 적대적 검증(W7-6V).
 *
 * 이웃한 `BlockSearchUi.test.tsx` 는 입력의 존재감(칩·예시·펼침 전이)을 잠근다. 감사가
 * 지적한 나머지 절반 — **결과 목록 쪽 단서** — 은 그 테스트가 건드리지 않는다:
 *   · F-41 결과가 몇 건인지 알 수 없고 잘린 곳에 스크롤 단서가 없다
 *   · F-11 결과 줄의 공정 칩이 무채색이라 지도·zone 패널의 색 문법과 따로 논다
 *
 * ⚠️ 검색이 `global-search` 한 모듈로 합쳐지면서(P2) 대상이 옮겨졌다 — 목록은 그 모듈의
 * 임베드 검색창(`SearchField`)이 그리고, 고른 뒤 남는 카드는 지도의 `MapFocusCard` 다.
 * 계약 자체는 그대로다: 목록이 몇 건인지 말하고, 넘치면 제 안에서 스크롤하고, 공정은
 * 목록에서도 카드에서도 공정색으로 말한다.
 */

const setup = () => renderWithProviders(<SearchField />)

/** 고른 결과 — 지도 카드는 주소에서 온 포커스를 받는다(제어 prop) */
function blockFocus(projNo: string, blockNo: string): MapFocus {
  const block = findBlock(projNo, blockNo)!
  return { blocks: [block], yard: null, assys: [], label: `${projNo}-${blockNo}`, kind: 'block' }
}

describe('검색 결과 목록 단서', () => {
  it('F-41 결과 개수가 목록 머리에 적힌다 — 몇 건인지 모른 채 스크롤하지 않는다', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('블록 검색'), '7004')

    const options = await screen.findAllByRole('option')
    /* 머리줄의 건수가 실제로 그려진 줄 수와 같아야 한다 — 숫자만 있고 안 맞으면 더 나쁘다 */
    expect(screen.getByText(`${options.length}건`)).toBeInTheDocument()
  })

  it('F-41 결과 목록이 제 높이 안에서 스크롤한다 — 잘린 채 단서 없이 끝나지 않는다', async () => {
    const { container } = setup()
    await userEvent.type(screen.getByLabelText('블록 검색'), '7004')
    await screen.findAllByRole('option')

    const scroller = container.querySelector('ul.overflow-y-auto')
    expect(scroller, '결과 목록에 스크롤 컨테이너가 없다 — 넘치는 결과가 잘려 사라진다').not.toBeNull()
    expect(scroller!.className).toMatch(/max-h-/)
  })

  it('F-11 결과 줄의 공정 칩이 공정색을 쓴다', async () => {
    const { container } = setup()
    await userEvent.type(screen.getByLabelText('블록 검색'), '7004')
    await screen.findAllByRole('option')

    const tinted = [...container.querySelectorAll('li span[style*="inset"]')]
    expect(tinted.length, '결과 줄의 공정 칩에 공정색 막대가 없다').toBeGreaterThan(0)
  })

  it('F-11 선택한 블록 카드의 공정 칩도 공정색을 쓴다', () => {
    const { container } = renderWithProviders(
      <MapFocusCard focus={blockFocus('7004', '222')} onClear={() => {}} />
    )

    const chip = [...container.querySelectorAll('span')].find(
      (el) => el.textContent?.trim() === '조립 중'
    )
    expect(chip, '선택한 블록 카드의 공정 칩을 못 찾았다').toBeDefined()
    expect(
      chip!.getAttribute('style') ?? '',
      `선택 카드의 공정 칩 "${chip!.textContent}" 이 무채색이다 — 목록과 같은 공정색을 써야 한다`
    ).toMatch(/inset/)
  })
})
