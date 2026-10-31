import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { FactoryNavPanel } from '../ui/FactoryNavPanel'

const factories = [
  { name: 'PBS', process: '조립' },
  { name: '3DS', process: '조립' },
  { name: '느태 도장공장', process: '도장' },
]

function setup(
  process: string | null = null,
  workCounts?: ReadonlyMap<string, number>,
  faultCounts?: ReadonlyMap<string, number>
) {
  const handlers = { onSelectProcess: vi.fn(), onSelectFactory: vi.fn(), onHoverFactory: vi.fn() }
  renderWithProviders(
    <FactoryNavPanel
      factories={factories}
      process={process}
      trail={<span>경로</span>}
      workCounts={workCounts}
      faultCounts={faultCounts}
      {...handlers}
    />
  )
  return handlers
}

describe('FactoryNavPanel — 공정 목록 → 그 공정의 공장 목록 (같은 카드에서 내용이 바뀐다)', () => {
  it('처음에는 공정 목록 — 공장 이름은 보이지 않는다', () => {
    setup()
    expect(screen.getByRole('button', { name: /조립/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /도장/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^PBS/ })).toBeNull()
  })

  it('공정 줄을 누르면 그 공정을 고른다(카드 전환은 부르는 쪽이 process 로)', () => {
    const h = setup()
    fireEvent.click(screen.getByRole('button', { name: /조립/ }))
    expect(h.onSelectProcess).toHaveBeenCalledWith('조립')
  })

  it('공정을 고르면 그 공정의 공장만 늘어놓고, 머리에 경로와 공정 이름이 선다', () => {
    setup('조립')
    expect(screen.getByText('경로')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '조립' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^PBS/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^3DS/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /느태 도장공장/ })).toBeNull()
  })

  it('공장 줄을 누르면 그 공장을 고르고, 손을 얹으면 지도에 알린다', () => {
    const h = setup('조립')
    fireEvent.mouseEnter(screen.getByRole('button', { name: /^PBS/ }))
    expect(h.onHoverFactory).toHaveBeenCalledWith('PBS')
    fireEvent.click(screen.getByRole('button', { name: /^3DS/ }))
    expect(h.onSelectFactory).toHaveBeenCalledWith('3DS')
  })

  it('공정 줄에는 그 공정 공장들의 진행 작업 합, 공장 줄에는 그 공장의 수', () => {
    const counts = new Map([['PBS', 12], ['3DS', 3], ['느태 도장공장', 0]])
    setup(null, counts)
    expect(screen.getByRole('button', { name: /조립/ })).toHaveTextContent('진행 15')
    expect(screen.getByRole('button', { name: /도장/ })).toHaveTextContent('진행 0')
  })

  it('공장 목록 단계 — 진행 n, 0 이면 작업 없음', () => {
    setup('조립', new Map([['PBS', 12], ['3DS', 0]]))
    expect(screen.getByRole('button', { name: /^PBS/ })).toHaveTextContent('진행 12')
    expect(screen.getByRole('button', { name: /^3DS/ })).toHaveTextContent('작업 없음')
  })

  it('공정 목록에는 점검 필요 아이콘을 달지 않는다', () => {
    setup(null, undefined, new Map([['PBS', 1], ['3DS', 2]]))
    expect(screen.queryAllByRole('img', { name: /점검 필요/ })).toHaveLength(0)
  })

  it('공장 목록 단계 — 점검이 필요한 공장 줄에만 ⚠ 아이콘', () => {
    setup('조립', undefined, new Map([['3DS', 2]]))
    expect(screen.getByRole('button', { name: /^3DS/ })).toContainElement(screen.getByRole('img', { name: '점검 필요 2' }))
    expect(screen.getByRole('button', { name: /^PBS/ }).querySelector('[role="img"]')).toBeNull()
  })
})
