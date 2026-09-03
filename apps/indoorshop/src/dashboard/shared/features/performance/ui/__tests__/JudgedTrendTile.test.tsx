import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../lib/testing/renderWithProviders'
import { JudgedTrendTile } from '../JudgedTrendTile'

/**
 * 조립 일자별 인식 추이 타일의 계약 (W7-2).
 *
 * 이 타일이 답하는 질문은 "수집이 어느 날 멈췄나" 하나다. 그래서 검사도 그 질문을 지키는
 * 성질에 건다 — **빈 날이 빈 날로 읽힐 것**, 그리고 **하루짜리 창에서는 추이라고 우기지
 * 않을 것**(막대 하나는 추이가 아니다).
 */
const WEEK = [
  { date: '2026-08-28', count: 4 },
  { date: '2026-08-29', count: 0 },
  { date: '2026-08-30', count: 2 },
  { date: '2026-08-31', count: 7 },
  { date: '2026-09-01', count: 3 },
  { date: '2026-09-02', count: 0 },
  { date: '2026-09-03', count: 5 },
]

describe('창이 여러 날일 때', () => {
  it('추이 그림이 선다', () => {
    renderWithProviders(<JudgedTrendTile trend={WEEK} />)
    expect(screen.getByRole('img', { name: '일자별 판별 건수 추이' })).toBeInTheDocument()
  })

  it('창의 모든 날이 막대로 선다 — 빈 날을 건너뛰지 않는다', () => {
    const { container } = renderWithProviders(<JudgedTrendTile trend={WEEK} />)
    expect(container.querySelectorAll('rect')).toHaveLength(7)
  })

  it('수집이 없던 날을 0 으로 말한다 — 빈 날이 곧 신호다', () => {
    renderWithProviders(<JudgedTrendTile trend={WEEK} />)
    expect(screen.getByText('2026-08-29 0건')).toBeInTheDocument()
    expect(screen.getByText('2026-09-02 0건')).toBeInTheDocument()
  })

  it('창 전체의 합계를 함께 낸다', () => {
    renderWithProviders(<JudgedTrendTile trend={WEEK} />)
    expect(screen.getByText('21건')).toBeInTheDocument()
  })
})

describe('창이 하루일 때', () => {
  it('막대 하나는 추이가 아니므로 그림을 세우지 않는다', () => {
    renderWithProviders(<JudgedTrendTile trend={[{ date: '2026-09-03', count: 5 }]} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('그래도 그날의 건수는 말한다 — 그림이 없다고 값까지 사라지지 않는다', () => {
    renderWithProviders(<JudgedTrendTile trend={[{ date: '2026-09-03', count: 5 }]} />)
    expect(screen.getByText('일자별 인식')).toBeInTheDocument()
    expect(screen.getByText('5건')).toBeInTheDocument()
  })
})

describe('수집이 하나도 없을 때', () => {
  it('0 건이라고 말한다 — 빈 자리로 두지 않는다', () => {
    renderWithProviders(
      <JudgedTrendTile
        trend={[
          { date: '2026-09-02', count: 0 },
          { date: '2026-09-03', count: 0 },
        ]}
      />
    )
    expect(screen.getByText('0건')).toBeInTheDocument()
  })
})
