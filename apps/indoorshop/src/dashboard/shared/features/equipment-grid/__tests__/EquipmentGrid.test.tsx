import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import type { StatusMeaning } from '../../../ui/statusPalette'
import { EquipmentGrid } from '../ui/EquipmentGrid'
import type { EquipmentCell } from '../model/cell'

/**
 * 그리드가 **함께 가야 하는 넷**을 실제로 하는가 (설비관제 레퍼런스 §3.6).
 * 이 중 상태순 정렬과 정상 감쇄가 빠지면 그리드 전환은 이득보다 손해다.
 */
const cell = (
  id: string,
  severity: StatusMeaning,
  extra: Partial<EquipmentCell> = {}
): EquipmentCell => ({
  id,
  typeId: 'LIDAR',
  label: id,
  lamps: [
    { label: '링크', meaning: severity },
    { label: '틸팅', meaning: 'done' },
    { label: '이상', meaning: severity },
  ],
  metric: { text: severity === 'done' ? '4분 전' : '오프라인 19분', meaning: severity },
  severity,
  ...extra,
})

const CELLS = [
  cell('LD-P01', 'done'),
  cell('LD-P02', 'error'),
  cell('LD-P03', 'done'),
  cell('LD-P04', 'warning'),
]

function cellButtons() {
  return within(screen.getByRole('list')).getAllByRole('button')
}

describe('설비 그리드 — 상태순 정렬', () => {
  it('이상 셀이 위로 온다 (정상 사이에 묻히지 않는다)', () => {
    renderWithProviders(<EquipmentGrid cells={CELLS} />)
    expect(cellButtons().map((b) => b.getAttribute('aria-label'))).toEqual([
      'LD-P02',
      'LD-P04',
      'LD-P01',
      'LD-P03',
    ])
  })
})

describe('설비 그리드 — 정상 감쇄', () => {
  it('정상 셀에만 감쇄 표시가 붙는다 — 색은 이상 전용이다', () => {
    renderWithProviders(<EquipmentGrid cells={CELLS} />)
    const attenuated = cellButtons().filter((b) => b.dataset.attenuated === 'true')
    expect(attenuated.map((b) => b.getAttribute('aria-label'))).toEqual(['LD-P01', 'LD-P03'])
  })

  it('이상 셀은 감쇄하지 않는다', () => {
    renderWithProviders(<EquipmentGrid cells={CELLS} />)
    const issues = cellButtons().filter((b) => b.dataset.issue === 'true')
    expect(issues.map((b) => b.getAttribute('aria-label'))).toEqual(['LD-P02', 'LD-P04'])
    for (const button of issues) expect(button.dataset.attenuated).toBe('false')
  })
})

describe("설비 그리드 — '이상만 보기'", () => {
  it('누르면 이상 셀만 남는다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<EquipmentGrid cells={CELLS} />)
    await user.click(screen.getByRole('button', { name: /이상만/ }))
    expect(cellButtons().map((b) => b.getAttribute('aria-label'))).toEqual(['LD-P02', 'LD-P04'])
  })

  it('이상이 없으면 그 사실을 말한다 — 빈 격자를 두지 않는다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P01', 'done')]} />)
    await user.click(screen.getByRole('button', { name: /이상만/ }))
    expect(screen.getByText('이상 없는 설비뿐입니다.')).toBeInTheDocument()
  })
})

describe('설비 그리드 — 밀도 2단·선택 상세', () => {
  it('밀도 토글이 있다', () => {
    renderWithProviders(<EquipmentGrid cells={CELLS} />)
    expect(screen.getByRole('button', { name: '넓게' })).toBeInTheDocument()
  })

  it('셀을 고르면 상세가 펴지고, 다시 누르면 접힌다', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <EquipmentGrid cells={[cell('LD-P01', 'done', { detail: <span>pan 12°</span> })]} />
    )
    expect(screen.queryByText('pan 12°')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'LD-P01' }))
    expect(screen.getByText('pan 12°')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'LD-P01' }))
    expect(screen.queryByText('pan 12°')).not.toBeInTheDocument()
  })
})

describe('설비 그리드 — 클릭 없이 보이는 것 (R13 완료 기준)', () => {
  it('셀에 신선도와 램프 셋이 늘 서 있다', () => {
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P01', 'done')]} />)
    expect(screen.getByText('4분 전')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'LD-P01' })
    expect(within(button).getByLabelText('링크')).toBeInTheDocument()
    expect(within(button).getByLabelText('틸팅')).toBeInTheDocument()
    expect(within(button).getByLabelText('이상')).toBeInTheDocument()
  })

  it('이상이면 수치 자리가 사유를 말한다 — 툴팁을 열지 않아도 된다', () => {
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P02', 'error')]} />)
    expect(screen.getByText('오프라인 19분')).toBeInTheDocument()
  })

  it('부기(note)는 클릭 없이 셀 안에 선다 — 틸팅 모드·각도가 그 자리다', () => {
    renderWithProviders(
      <EquipmentGrid cells={[cell('LD-P01', 'done', { note: '틸팅중 102°/-5°' })]} />
    )
    expect(screen.getByText('틸팅중 102°/-5°')).toBeInTheDocument()
  })
})

describe('설비 그리드 — 미니 트렌드는 이상·선택에만', () => {
  const trend = [
    { label: '1', value: 10 },
    { label: '2', value: 20 },
  ]

  it('정상 셀에는 그리지 않는다 (337칸 × 스파크라인을 만들지 않는다)', () => {
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P01', 'done', { trend })]} />)
    expect(screen.queryByRole('img', { name: 'LD-P01' })).not.toBeInTheDocument()
  })

  it('이상 셀에는 그린다', () => {
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P02', 'error', { trend })]} />)
    expect(screen.getByRole('img', { name: 'LD-P02' })).toBeInTheDocument()
  })

  it('정상이라도 고르면 그린다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P01', 'done', { trend })]} />)
    await user.click(screen.getByRole('button', { name: 'LD-P01' }))
    expect(screen.getByRole('img', { name: 'LD-P01' })).toBeInTheDocument()
  })
})

describe('설비 그리드 — 접근성', () => {
  it('시각은 격자지만 의미는 목록이다', () => {
    renderWithProviders(<EquipmentGrid cells={CELLS} />)
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(CELLS.length)
  })
})
