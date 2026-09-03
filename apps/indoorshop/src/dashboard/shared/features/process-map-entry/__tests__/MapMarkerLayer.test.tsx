import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { act } from '@testing-library/react'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import type { Viewport, YardView } from '../../yard-map'
import { MapMarkerLayer, type MapMarkerLayerHandle } from '../ui/MapMarkerLayer'
import type { MapEntryMarker } from '../model/types'

/*
 * 마커 층은 지도의 **매 프레임**마다 `update(view)` 를 받는다. 마커가 수백 개면 그때마다
 * 좌표 변환과 style 쓰기를 그 수만큼 한다 — 카메라가 그대로여도.
 *
 * 그래서 "같은 카메라면 건너뛴다"를 넣었고, 여기서 두 가지를 함께 지킨다:
 * 건너뛰는가(성능), 그리고 **건너뛰어서 자리가 틀어지지는 않는가**(결과).
 */

const VIEWPORT: Viewport = { width: 800, height: 600 }

const view = (over: Partial<YardView> = {}): YardView => ({
  centerLat: 34.87,
  centerLon: 128.7,
  scale: 200000,
  pitch: 0,
  bearing: 0,
  ...over,
})

const markers: MapEntryMarker[] = [
  { id: 'LD-1', factory: 'PBS', lat: 34.8701, lon: 128.7001 },
  { id: 'LD-2', factory: 'PBS', lat: 34.8702, lon: 128.7002 },
]

function setup() {
  const ref = createRef<MapMarkerLayerHandle>()
  renderWithProviders(
    <MapMarkerLayer
      ref={ref}
      markers={markers}
      selectedMarkerId={null}
      onSelectMarker={() => {}}
      renderMarker={(m) => <span>{m.id}</span>}
      selectedFactory="PBS"
      inOverview={false}
      hoveredFactory={null}
      memberFactories={[]}
      accentByName={new Map()}
      viewport={VIEWPORT}
    />
  )
  const nodes = () =>
    markers.map((m) => document.querySelector<HTMLElement>(`[aria-label="${m.id}"]`)!)
  /*
   * 카메라를 밀어 넣는다. LOD 판단이 바뀌면 React state 가 바뀌므로 act 로 감싸
   * 그 리렌더까지 흘려 보낸다 — 실제 화면에서도 전환은 한 프레임 뒤에 반영된다.
   */
  const update = (next: YardView) => {
    act(() => {
      ref.current!.update(next)
    })
  }
  return { ref, nodes, update }
}

describe('마커 층 — 같은 카메라면 다시 재지 않는다', () => {
  it('첫 update 는 모든 마커의 자리를 잡는다', () => {
    const { nodes, update } = setup()
    update(view())
    for (const node of nodes()) {
      expect(node.style.transform).toContain('translate3d')
      expect(node.style.visibility).toBe('visible')
    }
  })

  it('같은 카메라로 다시 부르면 style 을 건드리지 않는다', () => {
    const { nodes, update } = setup()
    update(view())

    /*
     * 표식을 심어 두고 같은 카메라로 다시 부른다 — 건너뛰었다면 표식이 그대로 남는다.
     * (값이 같더라도 style 쓰기는 그 자체로 비용이라, "결과가 같다"가 아니라 "쓰지 않았다"를 본다)
     */
    for (const node of nodes()) {
      node.style.transform = 'none'
      node.style.visibility = 'collapse'
    }
    update(view())

    expect(nodes().map((n) => n.style.transform)).toEqual(['none', 'none'])
    expect(nodes().map((n) => n.style.visibility)).toEqual(['collapse', 'collapse'])
  })

  it('카메라가 바뀌면 다시 잰다 — 건너뛰기가 움직임을 먹지 않는다', () => {
    const { nodes, update } = setup()
    update(view())
    const before = nodes().map((n) => n.style.transform)

    update(view({ centerLon: 128.7003 }))
    expect(nodes().map((n) => n.style.transform)).not.toEqual(before)
  })

  it('줌·기울기·방위가 바뀌어도 각각 다시 잰다', () => {
    const { nodes, update } = setup()
    update(view())
    const base = nodes()[0].style.transform

    update(view({ scale: 260000 }))
    const zoomed = nodes()[0].style.transform
    expect(zoomed).not.toBe(base)

    update(view({ scale: 260000, bearing: 30 }))
    expect(nodes()[0].style.transform).not.toBe(zoomed)
  })

  it('같은 카메라로 돌아오면 처음과 같은 자리다 — 건너뛰기가 상태를 어긋내지 않는다', () => {
    const { nodes, update } = setup()
    update(view())
    const first = nodes().map((n) => n.style.transform)

    update(view({ scale: 260000 }))
    update(view())
    expect(nodes().map((n) => n.style.transform)).toEqual(first)
  })
})

describe('마커 층 — LOD (줌아웃에서 뭉치고 줌인하면 편다)', () => {
  /** 두 공장 × 여러 대 — 드릴인 여부에 따라 무엇이 접히는지 본다 */
  const many: MapEntryMarker[] = [
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `PBS-${i}`,
      factory: 'PBS',
      lat: 34.87 + i * 0.00002,
      lon: 128.7 + i * 0.00002,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `GBS-${i}`,
      factory: 'GBS',
      lat: 34.8705 + i * 0.00002,
      lon: 128.7005 + i * 0.00002,
    })),
  ]

  function setupMany(over: { inOverview?: boolean; selectedFactory?: string } = {}) {
    const ref = createRef<MapMarkerLayerHandle>()
    renderWithProviders(
      <MapMarkerLayer
        ref={ref}
        markers={many}
        selectedMarkerId={null}
        onSelectMarker={() => {}}
        renderMarker={(m) => <span>{m.id}</span>}
        selectedFactory={over.selectedFactory ?? 'PBS'}
        inOverview={over.inOverview ?? false}
        hoveredFactory={null}
        memberFactories={[]}
        accentByName={new Map()}
        viewport={VIEWPORT}
      />
    )
    const update = (next: YardView) => {
      act(() => {
        ref.current!.update(next)
      })
    }
    const markerCount = () => document.querySelectorAll('[aria-label^="PBS-"],[aria-label^="GBS-"]').length
    const badges = () =>
      [...document.querySelectorAll('span[aria-hidden="true"]')].map((n) => n.textContent)
    return { update, markerCount, badges }
  }

  it('줌아웃(전체 보기)에서는 공장마다 뱃지 하나로 뭉친다 — 노드 수가 줄어든다', () => {
    const { update, markerCount, badges } = setupMany({ inOverview: true })
    update(view({ scale: 2000 }))
    expect(markerCount()).toBe(0)
    expect(badges().sort()).toEqual(['4', '6'])
  })

  it('줌인하면 전부 펼친다 — 뱃지가 사라지고 마커가 선다', () => {
    const { update, markerCount, badges } = setupMany({ inOverview: true })
    update(view({ scale: 2000 }))
    update(view({ scale: 4_000_000 }))
    expect(markerCount()).toBe(many.length)
    expect(badges()).toEqual([])
  })

  it('드릴인한 공장은 줌아웃에서도 낱개로 남는다 — 클릭 동작이 배율에 따라 달라지지 않는다', () => {
    const { update, badges } = setupMany({ inOverview: false, selectedFactory: 'PBS' })
    update(view({ scale: 2000 }))
    /* PBS 는 6개 그대로, GBS 만 뱃지로 */
    expect(document.querySelectorAll('[aria-label^="PBS-"]')).toHaveLength(6)
    expect(document.querySelectorAll('[aria-label^="GBS-"]')).toHaveLength(0)
    expect(badges()).toEqual(['4'])
  })

  it('낱개로 남은 드릴인 공장의 마커는 그대로 누를 수 있다', () => {
    const { update } = setupMany({ inOverview: false, selectedFactory: 'PBS' })
    update(view({ scale: 2000 }))
    const marker = document.querySelector<HTMLElement>('[aria-label="PBS-0"]')!
    expect(marker.className).toContain('pointer-events-auto')
    expect(marker.tabIndex).toBe(0)
  })

  it('뱃지는 클릭을 투과한다 — 대체한 마커들과 같은 동작', () => {
    const { update } = setupMany({ inOverview: true })
    update(view({ scale: 2000 }))
    const badge = document.querySelector<HTMLElement>('span[aria-hidden="true"]')!
    expect(badge.className).toContain('pointer-events-none')
  })
})
