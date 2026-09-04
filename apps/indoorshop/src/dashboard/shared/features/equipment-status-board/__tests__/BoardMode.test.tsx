import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { EquipmentStatusBoard } from '../ui/EquipmentStatusBoard'
import {
  resetEquipmentBoardModeForTest,
  setEquipmentBoardMode,
} from '../../../lib/equipmentBoardMode'
import type { BirdviewBay, BirdviewPoint } from '../../equipment-birdview'
import type { EquipmentCell } from '../../equipment-grid'

/*
 * ── 보기 모드 (R40) ──
 *
 * 자리 배분을 사람이 고른다. 계약은 셋이다 — **모드마다 무엇이 서는가**, 고른 것이
 * **남는가**, 그리고 배치 전용에서도 **링킹이 죽지 않는가**(그림만 남았다고 설비를
 * 고르지 못하면 알람 딥링크가 도착할 자리가 없어진다).
 */

const HULL = [
  { lat: 34.87, lon: 128.69 },
  { lat: 34.8715, lon: 128.69 },
  { lat: 34.8715, lon: 128.6935 },
  { lat: 34.87, lon: 128.6935 },
]

const BAYS: BirdviewBay[] = [{ id: 'PBS#1', label: '1', groupKey: '1', hull: HULL }]

const POINTS: BirdviewPoint[] = [
  {
    id: 'LD-P01',
    typeId: 'LIDAR',
    position: { lat: 34.8705, lon: 128.6905 },
    severity: 'done',
    tooltip: { title: 'LD-P01 · 라이다', status: '온라인', freshness: '1 BAY' },
    bay: '1',
  },
]

const CELLS: EquipmentCell[] = [
  {
    id: 'LD-P01',
    typeId: 'LIDAR',
    label: 'LD-P01',
    group: '1',
    lamps: [{ label: '링크', meaning: 'done', value: 'online' }],
    metric: { text: '13:02', meaning: 'done' },
    severity: 'done',
    note: '18°/42°',
  },
]

function renderBoard() {
  return renderWithProviders(
    <EquipmentStatusBoard
      factories={[{ name: 'PBS', total: 1, issues: 0 }]}
      selectedFactory="PBS"
      onSelectFactory={() => {}}
      bays={BAYS}
      points={POINTS}
      groups={[{ key: '1', title: '1 BAY', cells: CELLS }]}
    />
  )
}

describe('현황 보드 보기 모드 (R40)', () => {
  beforeEach(() => {
    resetEquipmentBoardModeForTest()
  })

  it('기본은 절반절반 — 그림과 목록이 함께 선다', () => {
    const { container } = renderBoard()
    expect(container.querySelector('svg[role="img"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-group]').length).toBe(1)
    expect(screen.getByRole('radio', { name: '절반절반' })).toHaveAttribute('aria-checked', 'true')
  })

  it('배치 전용을 고르면 목록이 사라지고 그림만 남는다', async () => {
    const user = userEvent.setup()
    const { container } = renderBoard()

    await user.click(screen.getByRole('radio', { name: '배치 전용' }))

    expect(container.querySelector('svg[role="img"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-group]').length).toBe(0)
    /* 배치 전용에서 접기는 뜻이 없다 — 접으면 빈 화면만 남는다 */
    expect(screen.queryByRole('button', { name: '배치 접기' })).toBeNull()
  })

  it('그림이 더 큰 자리를 얻는다 — 모드를 고른 이유가 그것이다', async () => {
    const user = userEvent.setup()
    const { container } = renderBoard()
    const half = container.querySelector('svg[role="img"]')!.parentElement!.className

    await user.click(screen.getByRole('radio', { name: '배치 전용' }))
    const full = container.querySelector('svg[role="img"]')!.parentElement!.className

    expect(half).toContain('30vh')
    expect(full).toContain('64vh')
    expect(full).not.toContain('max-h-')
  })

  it('고른 모드는 다시 세워도 남는다 — 매번 다시 고르게 하지 않는다', () => {
    setEquipmentBoardMode('birdview')
    const { container } = renderBoard()
    expect(screen.getByRole('radio', { name: '배치 전용' })).toHaveAttribute('aria-checked', 'true')
    expect(container.querySelectorAll('[data-group]').length).toBe(0)
  })

  it('배치 전용에서도 설비를 고르면 태그가 선다 — 알람 딥링크가 도착할 자리', async () => {
    const user = userEvent.setup()
    setEquipmentBoardMode('birdview')
    const { container } = renderBoard()

    await user.click(container.querySelector('[data-point="LD-P01"]')!)
    const tag = await screen.findByRole('tooltip')
    expect(tag.textContent).toContain('LD-P01')
    /* 목록이 없어도 카드의 값은 셀에서 온다(R36) — 두 층이 여전히 같은 말을 한다 */
    expect(tag.textContent).toContain('18°/42°')
    expect(tag.textContent).toContain('13:02')
  })

  it('딥링크로 들어온 초점 설비는 배치 전용에서도 골라진 채로 선다', async () => {
    setEquipmentBoardMode('birdview')
    renderWithProviders(
      <EquipmentStatusBoard
        factories={[{ name: 'PBS', total: 1, issues: 0 }]}
        selectedFactory="PBS"
        onSelectFactory={() => {}}
        bays={BAYS}
        points={POINTS}
        groups={[{ key: '1', title: '1 BAY', cells: CELLS }]}
        focusEquipmentId="LD-P01"
      />
    )
    expect((await screen.findByRole('tooltip')).textContent).toContain('LD-P01')
  })
})
