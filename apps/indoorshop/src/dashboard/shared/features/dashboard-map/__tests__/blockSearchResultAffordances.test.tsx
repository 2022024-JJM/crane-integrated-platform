import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { BlockSearch, type RosterSearchHit } from '../ui/BlockSearch'
import { findBlock } from '../../../entities/vessel'

/*
 * 블록 검색 **결과 목록**의 단서 계약 — UX 감사 F-41·F-11 적대적 검증(W7-6V).
 *
 * 이웃한 `BlockSearchUi.test.tsx` 는 입력의 존재감(칩·예시·펼침 전이)을 잠근다. 감사가
 * 지적한 나머지 절반 — **결과 목록 쪽 단서** — 은 그 테스트가 건드리지 않는다:
 *   · F-41 결과가 몇 건인지 알 수 없고 잘린 곳에 스크롤 단서가 없다
 *   · F-11 결과 줄의 공정 칩이 무채색이라 지도·zone 패널의 색 문법과 따로 논다
 * 앞엣것은 수리됐으므로 여기서 못박고, 뒤엣것은 아직 열려 있어 목표 계약만 적어 둔다.
 */

const noop = () => {}

const setup = (hit: RosterSearchHit | null = null) =>
  renderWithProviders(<BlockSearch loadIndex={null} hit={hit} onPick={noop} onClear={noop} />)

/** 고른 결과 — `hit` 은 부모가 쥐는 값이라(제어 prop) 클릭이 아니라 직접 넣어 준다 */
function pickedHit(projNo: string, blockNo: string): RosterSearchHit {
  const block = findBlock(projNo, blockNo)!
  return {
    kind: 'roster',
    id: `roster:${projNo}-${blockNo}`,
    projNo,
    blkNo: blockNo,
    block,
    matchedAssys: [],
  }
}

describe('블록 검색 결과 목록 단서', () => {
  it('F-41 결과 개수가 목록 머리에 적힌다 — 몇 건인지 모른 채 스크롤하지 않는다', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('블록 검색'), '7004')

    const rows = await screen.findAllByText(/^\d+-\w+$/)
    /* 머리줄의 건수가 실제로 그려진 줄 수와 같아야 한다 — 숫자만 있고 안 맞으면 더 나쁘다 */
    expect(screen.getByText(new RegExp(`\\b${rows.length}\\b`))).toBeInTheDocument()
  })

  it('F-41 결과 목록이 제 높이 안에서 스크롤한다 — 잘린 채 단서 없이 끝나지 않는다', async () => {
    const { container } = setup()
    await userEvent.type(screen.getByLabelText('블록 검색'), '7004')
    await screen.findAllByText(/^\d+-\w+$/)

    const scroller = container.querySelector('ul.overflow-y-auto')
    expect(scroller, '결과 목록에 스크롤 컨테이너가 없다 — 넘치는 결과가 잘려 사라진다').not.toBeNull()
    expect(scroller!.className).toMatch(/max-h-/)
  })

  /*
   * F-11 — 결과 줄의 공정 칩이 공정색을 쓰는가 (지도·zone 패널과 같은 색 문법).
   *
   * W7-6A(comms-ui)가 드롭다운 줄에는 공정색 좌측 막대를 얹었다(BlockSearch.tsx L307-312,
   * `boxShadow: inset 2px 0 0 ${zoneColor(...)}`). 그런데 **결과를 고른 뒤 서는 카드**
   * (`BlockHitBody`, L425-428)는 같은 `STAGE_KEY` 를 그리면서 여전히 무채색이다
   * (`border-white/16 text-white/62`). 감사 스크린샷(03-…)에서 지적한 자리가 바로 그
   * 카드였다 — 드롭다운은 고르는 순간 사라지고 남는 것이 이 카드다.
   */
  it('F-11 드롭다운 결과 줄의 공정 칩이 공정색을 쓴다', async () => {
    const { container } = setup()
    await userEvent.type(screen.getByLabelText('블록 검색'), '7004')
    await screen.findAllByText(/^\d+-\w+$/)

    const tinted = [...container.querySelectorAll('li span[style*="inset"]')]
    expect(
      tinted.length,
      '결과 줄의 공정 칩에 공정색 막대가 없다'
    ).toBeGreaterThan(0)
  })

  /* 선택 후 남는 카드도 같은 색 문법 — skip 을 풀어 계약으로 승격 (W7-6B 수정 루프) */
  it('F-11 선택한 블록 카드의 공정 칩도 공정색을 쓴다', () => {
    const { container } = setup(pickedHit('7004', '222'))

    const chip = [...container.querySelectorAll('span')].find(
      (el) => el.textContent?.trim() === '조립 중'
    )
    expect(chip, '선택한 블록 카드의 공정 칩을 못 찾았다').toBeDefined()
    expect(
      chip!.getAttribute('style') ?? '',
      `선택 카드의 공정 칩 "${chip!.textContent}" 이 무채색이다 — 드롭다운과 같은 공정색을 써야 한다`
    ).toMatch(/inset/)
  })
})
