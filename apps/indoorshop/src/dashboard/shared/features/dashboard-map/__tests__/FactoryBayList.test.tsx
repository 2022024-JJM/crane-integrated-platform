import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { FactoryBayList } from '../ui/FactoryBayList'
import { BayOccupantList } from '../ui/BayOccupantList'
import type { BayOccupancy, BayOccupant } from '../lib/bayOccupancy'

/*
 * 공장 상세의 베이 목록 (P1 ①) — 행은 그 베이의 **재실 요약**이고, 클릭은 드릴인이다.
 * 기준정보(면적·옥내외)는 이 자리에 없다.
 */
const occupant = (over: Partial<BayOccupant> = {}): BayOccupant => ({
  key: '2540-281',
  projNo: '2540',
  blockNo: '281',
  zone: 'assembly',
  assys: [],
  justArrived: false,
  path: '/indoorshop/zones/assembly/asm-pbs/asm-pbs-b8',
  ...over,
})

const bay = (over: Partial<BayOccupancy> = {}): BayOccupancy => {
  const occupants = over.occupants ?? [occupant()]
  return {
    bayId: 'PBS#8',
    label: '8BAY',
    occupants,
    blockCount: occupants.length,
    assyCount: occupants.reduce((n, o) => n + o.assys.length, 0),
    ...over,
  }
}

describe('FactoryBayList — 베이별 재실', () => {
  it('행에 그 베이의 블록과 수를 적는다 — 면적·옥내외는 적지 않는다', () => {
    renderWithProviders(<FactoryBayList bays={[bay()]} onOpenBay={() => {}} />)
    const row = screen.getByRole('button', { name: /8BAY/ })
    expect(row).toHaveTextContent('2540-281')
    expect(row).toHaveTextContent('블록 1')
    expect(row).not.toHaveTextContent('면적')
    expect(row).not.toHaveTextContent('옥내')
  })

  it('ASSY 가 올라온 자리는 그 수도 함께 적는다', () => {
    const bays = [
      bay({
        occupants: [
          occupant({ assys: [{ assyNo: 'A1', tier: 'sub' }, { assyNo: 'A2', tier: 'sub' }] }),
        ],
      }),
    ]
    expect(bays[0].assyCount).toBe(2)
    renderWithProviders(<FactoryBayList bays={bays} onOpenBay={() => {}} />)
    expect(screen.getByRole('button', { name: /8BAY/ })).toHaveTextContent('ASSY 2')
  })

  it('빈 베이는 비었다고 말한다 — 감추면 "안 불러왔다"와 구분이 안 된다', () => {
    renderWithProviders(
      <FactoryBayList bays={[bay({ occupants: [], blockCount: 0, assyCount: 0 })]} onOpenBay={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /8BAY/ })).toHaveTextContent('재실 없음')
  })

  it('행 클릭 = 그 베이로 드릴인', async () => {
    const onOpenBay = vi.fn()
    renderWithProviders(<FactoryBayList bays={[bay()]} onOpenBay={onOpenBay} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /8BAY/ }))
    expect(onOpenBay).toHaveBeenCalledWith('PBS#8')
  })

  it('베이가 없는 공장(매핑 없음)은 목록 자체를 만들지 않는다', () => {
    const { container } = renderWithProviders(<FactoryBayList bays={[]} onOpenBay={() => {}} />)
    expect(container.firstElementChild).toBeNull()
  })
})

describe('BayOccupantList — 베이 상세의 본문', () => {
  it('블록마다 한 줄, 그 블록의 공정 화면으로 나가는 링크다', () => {
    renderWithProviders(<BayOccupantList occupants={[occupant()]} />)
    expect(screen.getByRole('link', { name: /2540-281/ })).toHaveAttribute(
      'href',
      '/indoorshop/zones/assembly/asm-pbs/asm-pbs-b8',
    )
  })

  it('ASSY 이름과 갓 반입 표식을 함께 낸다', () => {
    renderWithProviders(
      <BayOccupantList
        occupants={[
          occupant({ assys: [{ assyNo: 'A1', tier: 'sub' }], justArrived: true }),
        ]}
      />,
    )
    const row = screen.getByRole('link', { name: /2540-281/ })
    expect(row).toHaveTextContent('A1')
    expect(row).toHaveTextContent('갓 반입')
  })

  it('재실이 없으면 비었다고 말한다', () => {
    renderWithProviders(<BayOccupantList occupants={[]} />)
    expect(screen.getByText('재실 없음')).toBeInTheDocument()
  })
})
