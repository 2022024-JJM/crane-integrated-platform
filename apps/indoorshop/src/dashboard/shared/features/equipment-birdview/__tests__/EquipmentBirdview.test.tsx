import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { EquipmentBirdview } from '../ui/EquipmentBirdview'
import type { BirdviewBay, BirdviewPoint } from '../model/types'

/*
 * 버드뷰가 **무엇을 그리는가**의 계약 (R41).
 *
 * 주인공은 베이 구획이다. 한때 모든 점을 감싸는 볼록 껍질을 '공장 외곽'으로 둘렀는데,
 * 그 선은 실제 건물 모양이 아니라 점들의 껍질이라 도면으로 읽는 순간 거짓말이 되고
 * 베이보다 굵게 서서 눈을 먼저 가져갔다. 사용자가 여러 번 뺄 것을 지시한 선이므로,
 * 눈으로 확인하는 대신 계약으로 못 박는다 — 다음 사람이 무심코 되살리지 않게.
 */

const HULL_A = [
  { lat: 34.87, lon: 128.69 },
  { lat: 34.8715, lon: 128.69 },
  { lat: 34.8715, lon: 128.6935 },
  { lat: 34.87, lon: 128.6935 },
]
const HULL_B = [
  { lat: 34.872, lon: 128.69 },
  { lat: 34.8735, lon: 128.69 },
  { lat: 34.8735, lon: 128.6935 },
  { lat: 34.872, lon: 128.6935 },
]

const BAYS: BirdviewBay[] = [
  { id: 'F#1', label: '1', groupKey: '1', hull: HULL_A },
  { id: 'F#2', label: '2', groupKey: '2', hull: HULL_B },
]

const POINTS: BirdviewPoint[] = [
  {
    id: 'LD-01',
    typeId: 'LIDAR',
    position: { lat: 34.8705, lon: 128.6905 },
    severity: 'done',
    tooltip: { title: 'LD-01 · 라이다', status: '온라인', freshness: '1 BAY' },
    bay: '1',
  },
  {
    id: 'LD-02',
    typeId: 'LIDAR',
    position: { lat: 34.8725, lon: 128.6925 },
    severity: 'done',
    tooltip: { title: 'LD-02 · 라이다', status: '온라인', freshness: '2 BAY' },
    bay: '2',
  },
]

function renderBirdview(bays: readonly BirdviewBay[] = BAYS) {
  return renderWithProviders(
    <EquipmentBirdview
      bays={bays}
      points={POINTS}
      selectedId={null}
      onSelectPoint={() => {}}
      hoveredId={null}
      onHoverPoint={() => {}}
      emptyLabel="표시할 설비 좌표가 없습니다"
    />
  )
}

/** 바닥에 깔린 도형 — 설비 심볼(글리프 안의 path)은 세지 않는다 */
function groundPaths(container: HTMLElement): SVGPathElement[] {
  const svg = container.querySelector('svg[role="img"]')!
  return [...svg.querySelectorAll('path')].filter((path) => !path.closest('[data-point]'))
}

describe('EquipmentBirdview — 베이만 그린다 (R41)', () => {
  it('공장 외곽 폴리곤을 그리지 않는다 — 바닥에 깔린 도형은 전부 베이다', () => {
    const { container } = renderBirdview()
    const paths = groundPaths(container)
    expect(paths).toHaveLength(BAYS.length)
    for (const path of paths) expect(path.getAttribute('data-bay')).not.toBeNull()
  })

  it('베이가 하나도 없으면 아무 구획도 그리지 않는다 (설비만 남는다)', () => {
    const { container } = renderBirdview([])
    expect(groundPaths(container)).toHaveLength(0)
    expect(container.querySelectorAll('[data-point]')).toHaveLength(POINTS.length)
  })

  it('베이 구획과 이름은 그대로 선다 — 뺀 것은 외곽선뿐이다', () => {
    const { container } = renderBirdview()
    expect(container.querySelector('[data-bay="1"]')).not.toBeNull()
    expect(container.querySelector('[data-bay="2"]')).not.toBeNull()
    const labels = [...container.querySelectorAll('svg text')].map((node) => node.textContent)
    expect(labels).toContain('1')
    expect(labels).toContain('2')
  })
})

/*
 * ── 종류색과 범례 ──
 *
 * 무채로만 그리면 57개의 판이 똑같은 회색 상자가 되고, 종류는 판 안의 8px 글리프 하나에
 * 걸린다 — 그 크기에서 라이다·캐비닛·Edge PC 는 갈리지 않는다. 그래서 목록의 종류 칩과
 * 같은 색 문법을 지도까지 잇는다. 색을 넣으면 **범례는 의무**다(읽는 법이 화면에 없으면
 * 색은 장식이 된다). 기본은 지금까지 그대로 — 의장·도장 그림은 손대지 않는다.
 */
const MIXED: BirdviewPoint[] = [
  ...POINTS,
  {
    id: 'PNL-01',
    typeId: 'PNL',
    position: { lat: 34.8708, lon: 128.6915 },
    severity: 'done',
    tooltip: { title: 'PNL-01 · 판넬', status: '온라인', freshness: '1 BAY' },
    bay: '1',
  },
  {
    id: 'ED-01',
    typeId: 'EDGE',
    position: { lat: 34.8712, lon: 128.692 },
    severity: 'warning',
    tooltip: { title: 'ED-01 · Edge PC', status: '오프라인', freshness: '1 BAY' },
    bay: '1',
  },
]

function renderMixed(colorByType: boolean) {
  return renderWithProviders(
    <EquipmentBirdview
      bays={BAYS}
      points={MIXED}
      selectedId={null}
      onSelectPoint={() => {}}
      hoveredId={null}
      onHoverPoint={() => {}}
      colorByType={colorByType}
      emptyLabel="빈 그림"
    />
  )
}

describe('버드뷰 — 종류색과 범례', () => {
  it('켜면 종류별 범례가 대수와 함께 선다 — 색은 읽는 법과 함께 와야 한다', () => {
    renderMixed(true)
    expect(screen.getByRole('button', { name: /라이다/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Edge PC/ })).toBeInTheDocument()
  })

  it('끄면 범례가 서지 않는다 — 지금까지의 그림 그대로', () => {
    renderMixed(false)
    expect(screen.queryByRole('button', { name: /라이다/ })).toBeNull()
  })

  it('범례의 종류를 고르면 그 종류만 남는다 — "판넬이 어디 있나"의 답', async () => {
    const user = userEvent.setup()
    const { container } = renderMixed(true)
    await user.click(screen.getByRole('button', { name: /라이다/ }))
    const dimmed = [...container.querySelectorAll('[data-point]')].filter((g) =>
      (g.getAttribute('class') ?? '').includes('opacity-[0.12]')
    )
    expect(dimmed.map((g) => g.getAttribute('data-point')).sort()).toEqual(['ED-01', 'PNL-01'])
  })

  it('다시 누르면 원래대로 돌아온다', async () => {
    const user = userEvent.setup()
    const { container } = renderMixed(true)
    const lidar = screen.getByRole('button', { name: /라이다/ })
    await user.click(lidar)
    await user.click(lidar)
    expect(container.querySelectorAll('[class*="opacity-[0.12]"]')).toHaveLength(0)
  })

  /* 물러나되 사라지지는 않는다 — 없는 점은 "그 자리에 아무것도 없다"는 거짓말이다 */
  it('고르지 않은 종류도 그림에 남는다', async () => {
    const user = userEvent.setup()
    const { container } = renderMixed(true)
    await user.click(screen.getByRole('button', { name: /라이다/ }))
    expect(container.querySelectorAll('[data-point]')).toHaveLength(MIXED.length)
  })
})

/*
 * 그리는 순서가 곧 의미 순서다 (R25-1) — 정상 → 베이 이름 → 이상.
 *
 * 이름을 정상 판 밑에 깔면 설비가 많은 칸에서는 아예 보이지 않는다(판은 불투명하다).
 * 그렇다고 맨 위로 올리면 이상 배지를 덮는다.
 */
describe('버드뷰 — 층 순서', () => {
  it('베이 이름은 정상 설비보다 뒤에, 이상 설비보다 앞에 그려진다', () => {
    const { container } = renderMixed(true)
    const svg = container.querySelector('svg[role="img"]')!
    /* 문서 순서가 곧 그리는 순서다 — 뒤에 오는 것이 위에 남는다 */
    const order = [...svg.querySelectorAll('[data-severity], [data-bay-tag]')].map(
      (node) => node.getAttribute('data-severity') ?? 'tag'
    )
    const tag = order.indexOf('tag')
    expect(tag).toBeGreaterThan(order.indexOf('done'))
    expect(tag).toBeLessThan(order.indexOf('warning'))
  })
})

/*
 * 고른 것을 **놓는 길**.
 *
 * 클릭으로 고르면 태그가 서고 나머지가 물러난다. 그 상태를 푸는 길이 "그 15px 판을 다시
 * 정확히 누르기" 하나뿐이면 화면이 붙잡힌 것처럼 느껴진다 — 지도에서 빈 곳을 누르는 것은
 * 어디서나 해제의 뜻이므로 그 관례를 그대로 둔다.
 */
describe('버드뷰 — 놓는 길', () => {
  function renderSelected(onSelectPoint: (id: string | null) => void) {
    return renderWithProviders(
      <EquipmentBirdview
        bays={BAYS}
        points={MIXED}
        selectedId="LD-01"
        onSelectPoint={onSelectPoint}
        hoveredId={null}
        onHoverPoint={() => {}}
        colorByType
        emptyLabel="빈 그림"
      />
    )
  }

  it('빈 바닥을 누르면 놓는다', async () => {
    const user = userEvent.setup()
    const calls: (string | null)[] = []
    const { container } = renderSelected((id) => calls.push(id))
    const floor = container.querySelector('svg[role="img"] > rect')!
    await user.click(floor)
    expect(calls).toContain(null)
  })

  it('빈 바닥을 누르면 범례 고름도 함께 풀린다', async () => {
    const user = userEvent.setup()
    const { container } = renderSelected(() => {})
    await user.click(screen.getByRole('button', { name: /라이다/ }))
    expect(container.querySelectorAll('[class*="opacity-[0.12]"]').length).toBeGreaterThan(0)
    await user.click(container.querySelector('svg[role="img"] > rect')!)
    expect(container.querySelectorAll('[class*="opacity-[0.12]"]')).toHaveLength(0)
  })

  /* ESC 는 한 번에 한 동작 — 범례가 잡혀 있으면 그것부터 푼다(설비는 보드가 쥔다) */
  it('ESC 로 범례 고름을 푼다', async () => {
    const user = userEvent.setup()
    const { container } = renderSelected(() => {})
    await user.click(screen.getByRole('button', { name: /라이다/ }))
    await user.keyboard('{Escape}')
    expect(container.querySelectorAll('[class*="opacity-[0.12]"]')).toHaveLength(0)
  })
})
