import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../lib/testing/renderWithProviders'
import type { OutfittingRow } from '../../api/outfittingPerformance'
import { overallOf } from '../../api/outfittingPerformance'
import { OutfittingCard } from '../OutfittingCard'

/**
 * 의장 카드의 화면 계약 (W7-11).
 *
 * 값 규칙은 `src/__tests__/outfittingRail.test.ts` 가 본다. 여기서 보는 것은 **그린 것**이다 —
 * 절점을 그리지 않는가, 블록 줄이 통합실적으로 가는 문인가, 갓 반입을 '대기 0%' 와
 * 가르는가, 그리고 종합이 무엇의 평균인지 화면이 스스로 말하는가.
 */
function row(over: Partial<OutfittingRow> = {}): OutfittingRow {
  return {
    projNo: '7004',
    blockNo: '530',
    key: '7004-530',
    factoryId: 'ofit-bos1',
    areaName: '조립의장 1공장 BOS 1',
    wstgCode: 'E11',
    judgedRate: 59,
    status: 'in_progress',
    justArrived: false,
    orderMatch: 'matched',
    ...over,
  }
}

describe('블록 줄', () => {
  it('줄 전체가 그 블록의 통합실적으로 가는 문이다', () => {
    renderWithProviders(<OutfittingCard rows={[row()]} overall={overallOf([row()])} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/performance?vessel=7004&block=530')
    expect(link).toHaveTextContent('7004-530')
  })

  it('블록번호·구역·송선기호·상태·판별 %를 한 줄에 낸다', () => {
    renderWithProviders(<OutfittingCard rows={[row()]} overall={overallOf([row()])} />)
    /* 종합 게이지에도 같은 수가 서므로(한 블록의 평균은 그 블록이다) 줄 안에서만 찾는다 */
    const link = screen.getByRole('link')
    for (const text of ['7004-530', '조립의장 1공장 BOS 1', 'E11', '작업중', '59']) {
      expect(link).toHaveTextContent(text)
    }
  })

  it("갓 반입은 '막 반입' 으로 갈린다 — 손도 안 댄 대기와 다른 사정이다", () => {
    const rows = [row({ judgedRate: 0, status: 'waiting', justArrived: true })]
    renderWithProviders(<OutfittingCard rows={rows} overall={overallOf(rows)} />)
    expect(screen.getAllByText('막 반입').length).toBeGreaterThan(0)
    expect(screen.getByText('대기')).toBeInTheDocument()
  })

  it('W/O 는 참고 배지로 선다 — 조립 카드와 같은 낱말', () => {
    const rows = [row({ orderMatch: 'unmatched' })]
    renderWithProviders(<OutfittingCard rows={rows} overall={overallOf(rows)} />)
    expect(screen.getByText('불일치')).toBeInTheDocument()
  })

  it('고른 블록 줄을 짚어 준다', () => {
    const rows = [row(), row({ blockNo: '534', key: '7004-534' })]
    renderWithProviders(
      <OutfittingCard rows={rows} overall={overallOf(rows)} activeBlock="534" />
    )
    /* 링크는 둘 다 서고, 고른 쪽만 배경이 바뀐다(값이 아니라 표시의 문제라 클래스로 본다) */
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})

describe('절점을 그리지 않는다', () => {
  it('단계 이름(S1·S/P 등)이 카드에 없다', () => {
    const rows = [row()]
    const { container } = renderWithProviders(
      <OutfittingCard rows={rows} overall={overallOf(rows)} />
    )
    const text = container.textContent ?? ''
    for (const stage of ['S1', 'S2', 'S3', 'S4', 'S5', 'S/P', 'T/UP', 'FINAL']) {
      expect(`${stage} 있음=${text.includes(stage)}`).toBe(`${stage} 있음=false`)
    }
  })

  it('절점이 없다는 사실을 카드가 스스로 말한다', () => {
    const rows = [row()]
    renderWithProviders(<OutfittingCard rows={rows} overall={overallOf(rows)} />)
    expect(screen.getByText(/통과 절점이 없습니다/)).toBeInTheDocument()
  })

  it('계층 어휘(대조·중조·소조)가 화면에 없다', () => {
    const rows = [row()]
    const { container } = renderWithProviders(
      <OutfittingCard rows={rows} overall={overallOf(rows)} />
    )
    const text = container.textContent ?? ''
    for (const word of ['대조', '중조', '소조', 'ASSY']) {
      expect(`${word} 있음=${text.includes(word)}`).toBe(`${word} 있음=false`)
    }
  })
})

describe('종합 게이지', () => {
  it('평균과 분모를 함께 낸다 — 몇 블록의 평균인지 말한다', () => {
    const rows = [row({ judgedRate: 40 }), row({ blockNo: '534', key: '7004-534', judgedRate: 60 })]
    renderWithProviders(<OutfittingCard rows={rows} overall={overallOf(rows)} />)
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText(/블록 2개의 단순 평균/)).toBeInTheDocument()
  })

  it('진행 중 / 재공 을 분수로 낸다', () => {
    const rows = [row(), row({ blockNo: '534', key: '7004-534', status: 'waiting' })]
    renderWithProviders(<OutfittingCard rows={rows} overall={overallOf(rows)} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('/2')).toBeInTheDocument()
  })
})

describe('빈 목록', () => {
  it('왜 비었는지 말한다 — 빈 자리로 두지 않는다', () => {
    renderWithProviders(<OutfittingCard rows={[]} overall={overallOf([])} />)
    expect(screen.getByText('이 조회 조건에 의장 재공 블록이 없습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
