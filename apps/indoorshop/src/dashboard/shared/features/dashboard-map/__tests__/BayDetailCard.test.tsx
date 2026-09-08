import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BayDetailCard } from '../ui/BayDetailCard'
import { DraggableCard } from '../../../ui/atoms/DraggableCard'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import type { BaySummary } from '../lib/bayDetail'

/*
 * 총괄('/') 지도 위 오버레이 카드가 **실제로 그려지는지** 본보기 한 건.
 *
 * 이 화면들은 지금까지 브라우저로만 확인해 왔는데, 그러면 "열어 봤다"가 곧 검증이라
 * 같은 회귀가 몇 번이고 돌아온다. 카드는 순수 프레젠테이션이므로 여기서 세우고
 * 읽으면 된다 — 지도(캔버스)는 필요 없다.
 */

const bay = (): BaySummary => ({
  id: '조립1공장#A',
  factory: '조립1공장',
  label: 'A베이',
  process: '조립',
  area: 12_345.6,
  indoor: 3,
  outdoor: 1,
  lots: [
    {
      lot: 'AL1',
      description: '조립 1공장 A베이',
      category: '공장(Shop)',
      area: 4000,
      place: '옥내',
    },
    {
      lot: 'AL2',
      description: '조립 1공장 A베이 옥외',
      category: '적치장',
      area: 8000,
      place: '옥외',
    },
  ],
})

function renderCard(over: Partial<Parameters<typeof BayDetailCard>[0]> = {}) {
  return renderWithProviders(
    <DraggableCard cardKey="detail">
      <BayDetailCard
        bay={bay()}
        highlightedLot={null}
        onSelectLot={() => {}}
        onHoverLot={() => {}}
        onBack={() => {}}
        onClose={() => {}}
        {...over}
      />
    </DraggableCard>,
  )
}

describe('BayDetailCard (총괄 지도 오버레이)', () => {
  it('베이 이름과 소속 공장, 면적·옥내외 수를 낸다', () => {
    renderCard()
    expect(screen.getByRole('heading', { name: 'A베이' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /조립1공장/ })).toBeInTheDocument()
    /* 면적은 반올림해 천 단위로 — 숫자를 그대로 흘리지 않는다 */
    expect(screen.getByText('12,346')).toBeInTheDocument()
  })

  it('지번 목록을 낱장으로 편다 — 코드와 원본 설명을 나란히', () => {
    renderCard()
    expect(screen.getByText('AL1')).toBeInTheDocument()
    expect(screen.getByText('조립 1공장 A베이 옥외')).toBeInTheDocument()
  })

  it('공정 몫의 본문(children)을 지번 목록 아래에 받는다', () => {
    renderCard({ children: <p>의장 블록 3건</p> })
    expect(screen.getByText('의장 블록 3건')).toBeInTheDocument()
  })

  it('닫기와 뒤로가 각각 제 콜백을 부른다', async () => {
    const onClose = vi.fn()
    const onBack = vi.fn()
    renderCard({ onClose, onBack })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: /조립1공장/ }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('머리글이 드래그 손잡이다 — 카드를 옮길 수 있다는 계약', () => {
    const { container } = renderCard()
    const handle = container.querySelector('[data-drag-handle]')
    expect(handle).not.toBeNull()
    /* 손잡이 안에 카드 제목이 있어야 "머리글을 잡는다"가 성립한다 */
    expect(handle).toContainElement(screen.getByRole('heading', { name: 'A베이' }))
  })
})
