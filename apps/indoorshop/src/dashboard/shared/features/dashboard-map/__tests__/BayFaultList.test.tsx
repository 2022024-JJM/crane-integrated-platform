import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { BayFaultList } from '../ui/BayFaultList'
import type { FaultEquipment } from '../lib/bayEquipmentFaults'

/*
 * 베이 카드의 점검 필요 목록 — 설비 한 줄씩, 누르면 그 설비를 짚은 현황 창.
 */
const equipment: FaultEquipment[] = [
  { id: 'ED-D3', typeId: 'EDGE', typeName: 'Edge PC', link: 'error' },
  { id: 'PT-D21', typeId: 'TILT', typeName: '틸팅모듈', link: 'offline' },
]

describe('BayFaultList', () => {
  it('설비마다 종류·ID·상태(현황 화면 낱말)를 한 줄에 낸다', () => {
    renderWithProviders(<BayFaultList process="조립" equipment={equipment} onOpen={() => {}} />)
    const edge = screen.getByRole('button', { name: /ED-D3/ })
    expect(edge).toHaveTextContent('Edge PC')
    expect(edge).toHaveTextContent('통신 오류')
    expect(screen.getByRole('button', { name: /PT-D21/ })).toHaveTextContent('오프라인')
  })

  it('도장의 끊김은 응답 없음', () => {
    renderWithProviders(
      <BayFaultList
        process="도장"
        equipment={[{ id: 'EQ039', typeId: 'DH', typeName: '제습기', link: 'offline' }]}
        onOpen={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /EQ039/ })).toHaveTextContent('응답 없음')
  })

  it('줄을 누르면 그 설비로 연다', () => {
    const onOpen = vi.fn()
    renderWithProviders(<BayFaultList process="조립" equipment={equipment} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: /PT-D21/ }))
    expect(onOpen).toHaveBeenCalledWith(equipment[1])
  })

  it('없으면 없다고 말한다', () => {
    renderWithProviders(<BayFaultList process="조립" equipment={[]} onOpen={() => {}} />)
    expect(screen.getByText('점검이 필요한 설비가 없습니다')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
