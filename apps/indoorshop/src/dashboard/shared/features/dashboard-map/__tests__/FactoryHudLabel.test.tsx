import { describe, expect, it, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import { createRef } from 'react'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { worldToScreen, type Viewport, type YardView } from '../../yard-map'
import {
  FactoryHudLabel,
  type FactoryHudLabelHandle,
} from '../ui/FactoryHudLabel'
import { ZoneJumpButton } from '../ui/ZoneJumpButton'

/*
 * 드릴인한 공장의 인씬 이름패 (R11 정정) — 지도 위 그 공장 위에 떠서 카메라를 따라다니고,
 * 바로 밑에 '공정 화면으로' 나가는 문이 붙는다. 앵커는 마커 층과 같은 투영(worldToScreen).
 */

const ANCHOR = { lat: 34.865, lon: 128.7066 }
const OUTLINE = [
  { lat: 34.8655, lon: 128.706 },
  { lat: 34.8645, lon: 128.7072 },
]
const VIEWPORT: Viewport = { width: 1280, height: 720 }

const view = (over: Partial<YardView> = {}): YardView => ({
  centerLat: 34.865,
  centerLon: 128.7066,
  scale: 400_000,
  pitch: 0,
  bearing: 0,
  ...over,
})

function renderHud(action?: React.ReactNode) {
  const ref = createRef<FactoryHudLabelHandle>()
  const result = renderWithProviders(
    <FactoryHudLabel
      ref={ref}
      name="GBS"
      anchor={ANCHOR}
      outline={OUTLINE}
      color="#3987e5"
      caption="조립"
      initialCamera={{ view: view(), viewport: VIEWPORT }}
      action={action}
    />,
  )
  return { ref, ...result }
}

/** 층 루트가 기록한 앵커(sx,baseY) — 투영 결과와 대조하는 눈 */
function anchorOf(container: HTMLElement): [number, number] {
  const raw = (container.firstElementChild as HTMLElement).dataset.hudAnchor!
  const [x, y] = raw.split(',').map(Number)
  return [x, y]
}

describe('FactoryHudLabel — 인씬 앵커', () => {
  it('앵커의 가로는 공장 centroid 의 화면 투영과 같다 (마커 층과 같은 경로)', () => {
    const { container } = renderHud()
    const [sx] = anchorOf(container)
    const projected = worldToScreen(view(), VIEWPORT, ANCHOR.lat, ANCHOR.lon)
    expect(sx).toBe(Math.round(projected.sx))
  })

  it('카메라가 움직이면 따라간다 — updateView 한 번에 앵커가 새 투영으로', () => {
    const { ref, container } = renderHud()
    /* 화면 안에 남을 만큼만 민다 — 컬링 여백 밖이면 패가 걷혀 앵커도 없다 */
    const moved = view({ centerLon: 128.7055 })
    act(() => ref.current!.updateView(moved, VIEWPORT))
    const [sx] = anchorOf(container)
    expect(sx).toBe(Math.round(worldToScreen(moved, VIEWPORT, ANCHOR.lat, ANCHOR.lon).sx))
  })

  it('확대해도 패 크기는 화면 고정 — 스케일이 transform 에 실리지 않는다', () => {
    const { ref, container } = renderHud()
    act(() => ref.current!.updateView(view({ scale: 1_600_000 }), VIEWPORT))
    /* 배율을 4배로 올려도 크기 관련 style 은 위치(left/top)뿐 — scale() 이 없다 */
    expect(container.innerHTML).not.toContain('scale(')
  })

  it("문(action)이 붙으면 그 조각만 클릭을 받는다 — 주소는 드릴다운 슬러그", () => {
    const { container } = renderHud(
      <ZoneJumpButton process="조립" factory="GBS" onStash={vi.fn()} />,
    )
    const link = screen.getByRole('link', { name: /조립 공정 화면 열기/ })
    expect(link).toHaveAttribute('href', '/zones/assembly?factory=asm-gbs')
    /* 층 루트는 지도 조작을 통과시키고(pointer-events-none), 문 래퍼만 받는다 */
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('pointer-events-none')
    expect(link.closest('.pointer-events-auto')).not.toBeNull()
    /* 클릭 가능한 문이 있으므로 층을 스크린리더에서 걷지 않는다 */
    expect(root.getAttribute('aria-hidden')).toBeNull()
  })

  it('문이 없으면(가공) 이름만 — 층은 순수 장식이라 aria-hidden', () => {
    const { container } = renderHud()
    expect(container.querySelector('a')).toBeNull()
    expect((container.firstElementChild as HTMLElement).getAttribute('aria-hidden')).toBe('true')
  })
})
