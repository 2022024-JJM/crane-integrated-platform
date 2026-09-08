import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { EquipmentStatusBoard } from '../ui/EquipmentStatusBoard'
import type { BirdviewBay, BirdviewPoint } from '../../equipment-birdview'
import type { EquipmentCell } from '../../equipment-grid'

/*
 * ── 태그와 아이콘의 계약 (R36 · R37) ──
 *
 * R36 — 태그는 **그리드 셀과 같은 말**을 한다. 값을 태그가 새로 계산하면 같은 설비가
 *       그림과 목록에서 다른 상태로 보이고, 그 순간부터 두 화면 다 못 믿게 된다.
 * R37 — 그림의 아이콘은 **목록의 아이콘과 같은 글리프**다. 그림 안에서만 통하는 도형을
 *       따로 두면 눈이 둘을 잇지 못한다. 색은 모노이고, 상태색은 이상에만 붙는다.
 */

const HULL = [
  { lat: 34.87, lon: 128.69 },
  { lat: 34.872, lon: 128.69 },
  { lat: 34.872, lon: 128.692 },
  { lat: 34.87, lon: 128.692 },
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
  {
    id: 'ED-P01',
    typeId: 'EDGE',
    position: { lat: 34.8715, lon: 128.6915 },
    severity: 'error',
    tooltip: { title: 'ED-P01 · Edge PC', status: '통신 오류', freshness: '1 BAY' },
    bay: '1',
  },
]

const CELLS: EquipmentCell[] = [
  {
    id: 'LD-P01',
    typeId: 'LIDAR',
    label: 'LD-P01',
    group: '1',
    lamps: [
      { label: '링크', meaning: 'done', value: 'online' },
      { label: '틸팅', meaning: 'inProgress', value: 'tilting' },
      { label: '이상', meaning: 'done' },
    ],
    metric: { text: '13:02', meaning: 'done' },
    severity: 'done',
    note: '18°/42° 틸팅중',
  },
  {
    id: 'ED-P01',
    typeId: 'EDGE',
    label: 'ED-P01',
    lamps: [
      { label: '링크', meaning: 'error', value: 'error' },
      { label: 'MQTT', meaning: 'error' },
    ],
    metric: { text: '통신 오류', meaning: 'error' },
    severity: 'error',
    note: '61°C · CPU 74%',
  },
]

function renderBoard() {
  return renderWithProviders(
    <EquipmentStatusBoard
      factories={[{ name: 'PBS', total: 2, issues: 1 }]}
      selectedFactory="PBS"
      onSelectFactory={() => {}}
      bays={BAYS}
      points={POINTS}
      groups={[{ key: '1', title: '1 BAY', cells: CELLS }]}
    />
  )
}

/** 이 요소와 자손이 걸친 상태색 클래스 — 팔레트의 잉크만 센다 */
function statusColorClasses(root: Element): string[] {
  return [root, ...root.querySelectorAll('*')]
    .flatMap((node) => (node.getAttribute('class') ?? '').split(/\s+/))
    .filter((name) => /^text-(status|glass)-(healthy|degraded|unhealthy|progress)$/.test(name))
}

describe('버드뷰 태그 — 그리드와 같은 말을 한다 (R36)', () => {
  it('심볼에 올리면 램프·특성값·최근 신호가 **셀의 값 그대로** 선다', async () => {
    const user = userEvent.setup()
    const { container } = renderBoard()

    await user.hover(container.querySelector('[data-point="LD-P01"]')!)
    const tag = await screen.findByRole('tooltip')

    /* 무엇인가 · 소재 */
    expect(tag.textContent).toContain('LD-P01')
    expect(tag.textContent).toContain('PBS')
    expect(tag.textContent).toContain('1 BAY')
    /* 램프 셋 — 라벨과 값이 셀의 것과 같다 */
    for (const lamp of CELLS[0].lamps) {
      expect(tag.textContent).toContain(lamp.label)
      if (lamp.value) expect(tag.textContent).toContain(lamp.value)
    }
    /* 종류별 핵심 특성값(R19)과 최근 신호 */
    expect(tag.textContent).toContain('18°/42° 틸팅중')
    expect(tag.textContent).toContain('13:02')
  })

  it('태그의 값과 셀의 값이 어긋나지 않는다 — 두 화면이 다른 말을 하지 않는다', async () => {
    const user = userEvent.setup()
    const { container } = renderBoard()

    await user.hover(container.querySelector('[data-point="ED-P01"]')!)
    const tag = await screen.findByRole('tooltip')
    const cell = screen.getByRole('button', { name: 'ED-P01' })

    /* 셀이 적은 대표값·수치가 태그에도 **같은 문자열로** 있다 */
    expect(cell.textContent).toContain('61°C · CPU 74%')
    expect(tag.textContent).toContain('61°C · CPU 74%')
    expect(cell.textContent).toContain('통신 오류')
    expect(tag.textContent).toContain('통신 오류')
  })

  it('고른 설비의 태그는 손을 떼도 남는다 — 알람 딥링크로 들어온 자리가 그대로 서 있게', async () => {
    const user = userEvent.setup()
    const { container } = renderBoard()

    await user.click(container.querySelector('[data-point="ED-P01"]')!)
    await user.unhover(container.querySelector('[data-point="ED-P01"]')!)
    expect((await screen.findByRole('tooltip')).textContent).toContain('ED-P01')
  })
})

describe('버드뷰 아이콘 — 그리드와 같은 글리프, 색은 모노 (R37)', () => {
  it('맵 심볼과 그리드 칩이 **같은 글리프**를 그린다 (아이콘 정의는 한 벌)', () => {
    const { container } = renderBoard()

    for (const id of ['LD-P01', 'ED-P01']) {
      const onMap = container.querySelector(`[data-point="${id}"] svg`)!
      const inGrid = screen.getByRole('button', { name: id }).querySelector('svg')!
      expect(onMap.innerHTML).toBe(inGrid.innerHTML)
      expect(onMap.innerHTML.length).toBeGreaterThan(0)
    }
  })

  it('종류가 다르면 글리프도 다르다 — 같은 그림을 두 종류에 쓰지 않는다', () => {
    const { container } = renderBoard()
    const lidar = container.querySelector('[data-point="LD-P01"] svg')!
    const edge = container.querySelector('[data-point="ED-P01"] svg')!
    expect(lidar.innerHTML).not.toBe(edge.innerHTML)
  })

  it('정상 설비에는 상태색이 붙지 않는다 — 초록 남발이 이상을 묻는다 (R18·R27)', () => {
    const { container } = renderBoard()
    const normal = container.querySelector('[data-point="LD-P01"]')!
    expect(statusColorClasses(normal)).toEqual([])
  })

  it('이상 설비에만 상태색 배지가 선다 — 색과 **모양**을 함께 낸다', () => {
    const { container } = renderBoard()
    const issue = container.querySelector('[data-point="ED-P01"]')!
    expect(statusColorClasses(issue)).toContain('text-status-unhealthy')
    /* error 의 부호는 사각 — 색각 이상에서도 갈린다(STATUS_SHAPE 계약) */
    expect(issue.querySelector('rect[fill="currentColor"]')).not.toBeNull()
  })
})
