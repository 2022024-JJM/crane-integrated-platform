import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { EquipmentStatusBoard, orderGroups } from '../ui/EquipmentStatusBoard'
import type { BirdviewBay, BirdviewPoint } from '../../equipment-birdview'
import type { EquipmentCell } from '../../equipment-grid'
import type { StatusMeaning } from '../../../ui/statusPalette'

/*
 * 현황 보드의 계약 — **두 층이 같은 설비를 가리키는가**(P4 ⓓ).
 *
 * 버드뷰와 그리드를 나란히 둔 유일한 이유가 그것이다. 심볼을 눌렀는데 아래 목록이
 * 가만히 있으면, 그림은 예쁜 장식이고 목록은 여전히 혼자 일한다.
 */

function cellOf(id: string, group: string, severity: StatusMeaning = 'done'): EquipmentCell {
  return {
    id,
    typeId: 'LIDAR',
    label: id,
    group,
    lamps: [{ label: '링크', meaning: severity }],
    metric: { text: severity === 'done' ? '방금' : '통신 오류', meaning: severity },
    severity,
  }
}

const HULL_A = [
  { lat: 34.87, lon: 128.69 },
  { lat: 34.872, lon: 128.69 },
  { lat: 34.872, lon: 128.692 },
]
const HULL_B = [
  { lat: 34.875, lon: 128.695 },
  { lat: 34.877, lon: 128.695 },
  { lat: 34.877, lon: 128.697 },
]

const BAYS: BirdviewBay[] = [
  { id: 'F#1', label: '1', groupKey: '1', hull: HULL_A },
  { id: 'F#2', label: '2', groupKey: '2', hull: HULL_B },
]

const POINTS: BirdviewPoint[] = [
  {
    id: 'LD-A',
    typeId: 'LIDAR',
    position: { lat: 34.871, lon: 128.6905 },
    severity: 'done',
    tooltip: { title: 'LD-A · 라이다', status: '온라인', freshness: '1 BAY' },
    bay: '1',
  },
  {
    id: 'LD-B',
    typeId: 'LIDAR',
    position: { lat: 34.876, lon: 128.6955 },
    severity: 'error',
    tooltip: { title: 'LD-B · 라이다', status: '통신 오류', freshness: '2 BAY' },
    bay: '2',
  },
]

function renderBoard() {
  return renderWithProviders(
    <EquipmentStatusBoard
      factories={[
        { name: 'PBS', total: 2, issues: 1 },
        { name: 'OFD', total: 0, issues: 0 },
      ]}
      selectedFactory="PBS"
      onSelectFactory={() => {}}
      bays={BAYS}
      points={POINTS}
      groups={[
        { key: '1', title: '1 BAY', cells: [cellOf('LD-A', '1')] },
        /* 버드뷰의 LD-B 가 이상이면 셀도 이상이라야 한다 — 두 층은 같은 설비를 말한다 */
        { key: '2', title: '2 BAY', cells: [cellOf('LD-B', '2', 'error')] },
      ]}
    />
  )
}

describe('EquipmentStatusBoard', () => {
  it('공장 목록이 왼쪽에 서고 현재 공장이 눌려 있다 (공장 탭바를 대신한다)', async () => {
    renderBoard()
    const list = await screen.findByRole('list', { name: '공장 목록' })
    expect(list.textContent).toContain('PBS')
    expect(screen.getByRole('button', { name: /PBS/ })).toHaveAttribute('aria-pressed', 'true')
    /* 접힌 줄에 이미 대수와 점검 필요가 보인다 — 열지 않고 훑기 위한 것 */
    expect(list.textContent).toContain('1/2')
    expect(list.textContent).toContain('점검 필요 1')
  })

  it('버드뷰 심볼을 누르면 그 셀이 선택된다 (그림 → 목록)', async () => {
    const user = userEvent.setup()
    const { container } = renderBoard()

    const symbol = container.querySelector('[data-point="LD-B"]')!
    await user.click(symbol)

    expect(screen.getByRole('button', { name: /LD-B/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /LD-A/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('그리드 셀을 고르면 버드뷰의 그 점이 링을 얻는다 (목록 → 그림)', async () => {
    const user = userEvent.setup()
    const { container } = renderBoard()

    /* 고르기 전에는 어느 점에도 강조 링이 없다 (링의 도형은 계약이 아니다 — 있고 없음이다) */
    expect(container.querySelectorAll('[data-point] [stroke-width="2"]').length).toBe(0)

    await user.click(screen.getByRole('button', { name: /LD-A/ }))
    const ring = container.querySelector('[data-point="LD-A"] [stroke-width="2"]')
    expect(ring).not.toBeNull()
  })

  it('심볼에 마우스를 올리면 ID·상태·자리가 툴팁으로 선다', async () => {
    const user = userEvent.setup()
    const { container } = renderBoard()

    await user.hover(container.querySelector('[data-point="LD-B"]')!)
    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent).toContain('LD-B')
    expect(tip.textContent).toContain('통신 오류')
    expect(tip.textContent).toContain('2 BAY')
  })

  it('베이를 누르면 그리드가 그 구획으로 점프한다 (맨 위로)', async () => {
    const user = userEvent.setup()
    const { container } = renderBoard()

    const titlesBefore = [...container.querySelectorAll('[data-group] h4')].map((h) => h.textContent)
    expect(titlesBefore).toEqual(['1 BAY', '2 BAY'])

    await user.click(container.querySelector('[data-bay="2"]')!)

    const titlesAfter = [...container.querySelectorAll('[data-group] h4')].map((h) => h.textContent)
    expect(titlesAfter).toEqual(['2 BAY', '1 BAY'])
  })

  it('버드뷰가 이상 설비를 더 크게 그린다 — 정상 위에 얹혀야 눈에 든다', () => {
    const { container } = renderBoard()
    const drawn = [...container.querySelectorAll('[data-point]')].map((g) => g.getAttribute('data-severity'))
    /* 이상이 나중에(=위에) 그려진다 */
    expect(drawn.at(-1)).toBe('error')
  })
})

/*
 * R29 — 위는 붙어 있고 아래만 흐른다.
 *
 * 그림이 스크롤에 밀려 사라지면 링킹은 "눌렀는데 아무 일도 없다"가 된다. 붙어 있는지를
 * 눈으로만 확인하면 다음 사람이 무심코 떼어 놓으므로 계약으로 못 박는다.
 */
describe('EquipmentStatusBoard — 붙어 있는 머리 (R29)', () => {
  it('요약 스트립·버드뷰가 한 덩어리로 붙어 있고, 그리드는 그 밖에 있다', () => {
    const { container } = renderBoard()
    const head = container.querySelector('[data-sticky-head="true"]')!
    expect(head.className).toContain('sticky')
    /* 버드뷰는 머리 안, 그리드 구획은 머리 밖 */
    expect(head.querySelector('svg[role="img"]')).not.toBeNull()
    expect(head.querySelector('[data-group]')).toBeNull()
    expect(container.querySelector('[data-group]')).not.toBeNull()
  })

  it('요약 스트립의 수치는 아래 그리드의 합계다 — 두 곳이 다른 말을 하지 않는다', () => {
    const { container } = renderBoard()
    const head = container.querySelector('[data-sticky-head="true"]')!
    /* 설비 2대(LD-A 정상 · LD-B 이상), 베이 2구획 */
    expect(head.textContent).toContain('설비')
    expect(head.textContent).toContain('점검 필요')
    expect(head.textContent).toContain('베이')
    const numbers = [...head.querySelectorAll('span.font-mono')].map((n) => n.textContent)
    expect(numbers).toEqual(['2', '1', '2'])
  })

  it('배치를 접으면 그림만 사라지고 목록·요약은 남는다 (낮은 화면용 탈출구)', async () => {
    const user = userEvent.setup()
    const { container } = renderBoard()
    expect(container.querySelector('svg[role="img"]')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: '배치 접기' }))
    expect(container.querySelector('svg[role="img"]')).toBeNull()
    expect(container.querySelectorAll('[data-group]').length).toBe(2)
    expect(screen.getByRole('button', { name: /LD-A/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '배치 펴기' }))
    expect(container.querySelector('svg[role="img"]')).not.toBeNull()
  })

  it('셀은 붙어 있는 머리 높이만큼 비켜서 선다 — 데려온 칸이 머리 뒤에 숨지 않게', () => {
    const { container } = renderBoard()
    const item = container.querySelector('[data-group] li')!
    expect(item.getAttribute('style')).toContain('--board-head')
  })
})

describe('orderGroups', () => {
  const groups = [
    { key: 'a', title: 'A', cells: [] },
    { key: 'b', title: 'B', cells: [] },
    { key: 'c', title: 'C', cells: [] },
  ]

  it('고른 구획만 앞으로 오고 나머지 순서는 그대로다', () => {
    expect(orderGroups(groups, 'b').map((g) => g.key)).toEqual(['b', 'a', 'c'])
  })

  it('고른 것이 없으면 원래 순서다', () => {
    expect(orderGroups(groups, null).map((g) => g.key)).toEqual(['a', 'b', 'c'])
  })
})
