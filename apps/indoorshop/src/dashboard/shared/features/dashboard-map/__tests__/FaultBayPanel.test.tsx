import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { FaultBayPanel } from '../ui/FaultBayPanel'
import type { FaultBay } from '../lib/bayEquipmentFaults'

/*
 * 야드 맵 오른쪽 문제 BAY 목록 — 줄 클릭은 그 베이로 드릴인, 손을 얹으면 지도가 짚는다.
 */
const faultBay = (over: Partial<FaultBay> = {}): FaultBay => ({
  bayId: '3DS#3',
  factory: '3DS',
  label: '3BAY',
  process: '조립',
  lotCodes: ['L1'],
  equipment: [
    { id: 'ED-D3', typeId: 'EDGE', typeName: 'Edge PC', link: 'error' },
    { id: 'PT-D21', typeId: 'TILT', typeName: '틸팅모듈', link: 'offline' },
  ],
  ...over,
})

/** 처음엔 접혀 있다 — 머리를 눌러 편다 */
async function expand() {
  await userEvent.setup().click(screen.getByRole('button', { name: /점검 필요/ }))
}

describe('FaultBayPanel', () => {
  it('처음에는 접혀 있고 머리를 누르면 펴지고, 다시 누르면 접힌다', async () => {
    renderWithProviders(
      <FaultBayPanel bays={[faultBay()]} selectedBayId={null} onOpenBay={() => {}} onHoverBay={() => {}} />,
    )
    const head = screen.getByRole('button', { name: /점검 필요/ })
    expect(head).toHaveAttribute('aria-expanded', 'false')
    expect(head).toHaveTextContent('1')
    expect(screen.queryByRole('button', { name: /3DS.*3BAY/ })).toBeNull()

    await expand()
    expect(head).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /3DS.*3BAY/ })).toBeInTheDocument()

    await expand()
    expect(head).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /3DS.*3BAY/ })).toBeNull()
  })


  it('공장·베이와 아픈 설비(종류·ID·상태)를 한 줄에 낸다 — 장애 수는 적지 않는다', async () => {
    renderWithProviders(
      <FaultBayPanel bays={[faultBay()]} selectedBayId={null} onOpenBay={() => {}} onHoverBay={() => {}} />,
    )
    await expand()
    const row = screen.getByRole('button', { name: /3DS.*3BAY/ })
    expect(row).not.toHaveTextContent('설비 장애')
    expect(row).toHaveTextContent('Edge PC')
    expect(row).toHaveTextContent('ED-D3')
    /* 현황 화면과 같은 낱말 — 조립 현황은 통신 오류·오프라인 */
    expect(row).toHaveTextContent('통신 오류')
    expect(row).toHaveTextContent('오프라인')
  })

  it('도장의 끊김은 도장 현황처럼 응답 없음으로 부른다', async () => {
    renderWithProviders(
      <FaultBayPanel
        bays={[
          faultBay({
            bayId: '느태 도장공장#NP1',
            factory: '느태 도장공장',
            label: 'NP1BAY',
            process: '도장',
            equipment: [{ id: 'EQ052', typeId: 'DH', typeName: '제습기', link: 'offline' }],
          }),
        ]}
        selectedBayId={null}
        onOpenBay={() => {}}
        onHoverBay={() => {}}
      />,
    )
    await expand()
    const row = screen.getByRole('button', { name: /NP1BAY/ })
    expect(row).toHaveTextContent('응답 없음')
    expect(row).not.toHaveTextContent('오프라인')
  })

  it('줄 클릭은 그 베이를 연다, 손을 얹으면 그 베이를 알리고 벗어나면 null', async () => {
    const onOpenBay = vi.fn()
    const onHoverBay = vi.fn()
    renderWithProviders(
      <FaultBayPanel bays={[faultBay()]} selectedBayId={null} onOpenBay={onOpenBay} onHoverBay={onHoverBay} />,
    )
    await expand()
    const user = userEvent.setup()
    const row = screen.getByRole('button', { name: /3DS.*3BAY/ })
    await user.hover(row)
    expect(onHoverBay).toHaveBeenLastCalledWith(expect.objectContaining({ bayId: '3DS#3' }))
    await user.click(row)
    expect(onOpenBay).toHaveBeenCalledWith(expect.objectContaining({ bayId: '3DS#3' }))
    await user.unhover(screen.getByRole('list'))
    expect(onHoverBay).toHaveBeenLastCalledWith(null)
  })

  it('장애가 없으면 없다고 말한다 — 패널이 사라지면 "정상"과 "안 불러옴"이 같아진다', async () => {
    renderWithProviders(
      <FaultBayPanel bays={[]} selectedBayId={null} onOpenBay={() => {}} onHoverBay={() => {}} />,
    )
    await expand()
    expect(screen.getByText('점검이 필요한 BAY 가 없습니다')).toBeInTheDocument()
  })
})
