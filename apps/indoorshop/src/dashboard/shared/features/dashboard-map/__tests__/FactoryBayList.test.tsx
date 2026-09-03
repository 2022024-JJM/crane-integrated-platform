import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { FactoryBayList } from '../ui/FactoryBayList'
import type { BaySummary } from '../lib/bayDetail'

/*
 * 공장 상세의 베이 목록 (R14) — 행은 베이 상세의 축약판(면적·옥내·옥외),
 * 클릭은 그 베이로의 드릴인이다.
 */
const bay = (over: Partial<BaySummary>): BaySummary => ({
  id: 'GBS#3',
  factory: 'GBS',
  label: '3BAY',
  process: '조립',
  lots: [],
  area: 14_410.4,
  indoor: 3,
  outdoor: 1,
  ...over,
})

describe('FactoryBayList', () => {
  it('베이마다 한 행 — 이름과 축약 요약(면적·옥내·옥외)이 상세와 같은 어휘로 선다', () => {
    renderWithProviders(
      <FactoryBayList
        bays={[bay({}), bay({ id: 'GBS#2', label: '2BAY', area: 8000, indoor: 2, outdoor: 0 })]}
        onOpenBay={() => {}}
      />,
    )
    const row = screen.getByRole('button', { name: /3BAY/ })
    expect(row).toHaveTextContent('면적 14,410 m²')
    expect(row).toHaveTextContent('옥내 3')
    expect(row).toHaveTextContent('옥외 1')
    expect(screen.getByRole('button', { name: /2BAY/ })).toHaveTextContent('면적 8,000 m²')
  })

  it('행 클릭 = 그 베이로 드릴인', async () => {
    const onOpenBay = vi.fn()
    renderWithProviders(<FactoryBayList bays={[bay({})]} onOpenBay={onOpenBay} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /3BAY/ }))
    expect(onOpenBay).toHaveBeenCalledWith('GBS#3')
  })

  it('베이가 없는 공장(매핑 없음)은 목록 자체를 만들지 않는다', () => {
    const { container } = renderWithProviders(<FactoryBayList bays={[]} onOpenBay={() => {}} />)
    expect(container.firstElementChild).toBeNull()
  })
})
