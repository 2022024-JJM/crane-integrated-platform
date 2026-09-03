import { describe, expect, it } from 'vitest'
import type { Viewport, YardView } from '../../yard-map'
import {
  COLLAPSE_SPREAD_PX,
  EXPAND_SPREAD_PX,
  resolveMarkerLod,
  sameLod,
} from '../lib/markerLod'
import type { MapEntryMarker } from '../model/types'

/**
 * 마커 LOD — **언제 뭉치고 언제 펴는가**.
 *
 * 성능을 위해 노드를 줄이는 일이라, 잘못 뭉치면 곧바로 기능 손실이다. 그래서 "줄었는가"
 * 보다 **"누를 수 있는 것을 접지는 않았는가"** 를 먼저 못 박는다.
 */
const VIEWPORT: Viewport = { width: 1000, height: 800 }

const view = (scale: number): YardView => ({
  centerLat: 34.87,
  centerLon: 128.7,
  scale,
  pitch: 0,
  bearing: 0,
})

/** 한 공장에 마커 n개를 가로로 흩는다 — 간격은 배율이 정한다 */
function factoryMarkers(factory: string, count: number, spanDeg: number): MapEntryMarker[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${factory}-${i}`,
    factory,
    lat: 34.87,
    lon: 128.7 + (spanDeg * i) / Math.max(1, count - 1),
  }))
}

const NONE = new Set<string>()

describe('LOD — 누를 수 있는 것은 접지 않는다', () => {
  it('드릴인한 공장은 아무리 좁아도 낱개로 편다', () => {
    const markers = factoryMarkers('PBS', 50, 0.00001) // 사실상 한 점
    const result = resolveMarkerLod({
      markers,
      view: view(20000),
      viewport: VIEWPORT,
      keepFactory: 'PBS',
      altitude: 0,
      expanded: NONE,
    })
    expect(result.expanded.has('PBS')).toBe(true)
    expect(result.clusters).toEqual([])
  })

  it('전체 보기(누를 수 있는 공장 없음)에서는 좁은 공장을 전부 접는다', () => {
    const markers = [
      ...factoryMarkers('PBS', 40, 0.00001),
      ...factoryMarkers('GBS', 30, 0.00001),
    ]
    const result = resolveMarkerLod({
      markers,
      view: view(20000),
      viewport: VIEWPORT,
      keepFactory: null,
      altitude: 0,
      expanded: NONE,
    })
    expect(result.expanded.size).toBe(0)
    expect(result.clusters.map((c) => [c.factory, c.count])).toEqual([
      ['PBS', 40],
      ['GBS', 30],
    ])
  })
})

describe('LOD — 벌어진 만큼 편다', () => {
  it('충분히 벌어지면 펴고, 좁으면 접는다', () => {
    const markers = factoryMarkers('PBS', 10, 0.01)
    const wide = resolveMarkerLod({
      markers,
      view: view(1_000_000), // 0.01도 ≈ 8200px 로 벌어짐
      viewport: VIEWPORT,
      keepFactory: null,
      altitude: 0,
      expanded: NONE,
    })
    expect(wide.expanded.has('PBS')).toBe(true)

    const narrow = resolveMarkerLod({
      markers,
      view: view(1000), // 같은 마커가 몇 픽셀 안으로 모임
      viewport: VIEWPORT,
      keepFactory: null,
      altitude: 0,
      expanded: NONE,
    })
    expect(narrow.expanded.has('PBS')).toBe(false)
    expect(narrow.clusters[0].count).toBe(10)
  })

  it('접는 문턱이 펴는 문턱보다 낮다 — 경계에서 떨지 않는다', () => {
    expect(COLLAPSE_SPREAD_PX).toBeLessThan(EXPAND_SPREAD_PX)
  })

  it('이미 펴져 있으면 더 좁아져야 접는다 (히스테리시스)', () => {
    const markers = factoryMarkers('PBS', 5, 0.01)
    /* 두 문턱 사이의 배율을 고른다 — 벌어짐이 110px 초과 150px 미만이 되게 */
    const between = view(14000) // 0.01도 × 0.82 × 14000 ≈ 115px
    const fromCollapsed = resolveMarkerLod({
      markers,
      view: between,
      viewport: VIEWPORT,
      keepFactory: null,
      altitude: 0,
      expanded: NONE,
    })
    const fromExpanded = resolveMarkerLod({
      markers,
      view: between,
      viewport: VIEWPORT,
      keepFactory: null,
      altitude: 0,
      expanded: new Set(['PBS']),
    })
    /* 같은 카메라인데 직전 상태에 따라 다르게 결정된다 = 히스테리시스가 작동한다 */
    expect(fromCollapsed.expanded.has('PBS')).toBe(false)
    expect(fromExpanded.expanded.has('PBS')).toBe(true)
  })
})

describe('LOD — 뱃지의 자리와 수', () => {
  it('뱃지는 접힌 마커들의 한가운데 선다', () => {
    const markers = factoryMarkers('PBS', 3, 0.0001)
    const result = resolveMarkerLod({
      markers,
      view: view(20000),
      viewport: VIEWPORT,
      keepFactory: null,
      altitude: 0,
      expanded: NONE,
    })
    const cluster = result.clusters[0]
    /* 가운데 마커(두 번째)의 자리와 사실상 같아야 한다 */
    expect(cluster.sx).toBeCloseTo(VIEWPORT.width / 2 + 0.82 * 20000 * 0.00005, 0)
    expect(cluster.sy).toBeCloseTo(VIEWPORT.height / 2, 5)
  })

  it('접힌 수의 합 + 펼친 마커 수 = 전체 마커 수 — 흘리는 마커가 없다', () => {
    const markers = [
      ...factoryMarkers('PBS', 40, 0.00001),
      ...factoryMarkers('GBS', 30, 0.00001),
      ...factoryMarkers('NPS', 12, 0.00001),
    ]
    const result = resolveMarkerLod({
      markers,
      view: view(20000),
      viewport: VIEWPORT,
      keepFactory: 'NPS',
      altitude: 0,
      expanded: NONE,
    })
    const clustered = result.clusters.reduce((sum, c) => sum + c.count, 0)
    const shown = markers.filter((m) => result.expanded.has(m.factory)).length
    expect(clustered + shown).toBe(markers.length)
    expect(shown).toBe(12) // 드릴인한 NPS 만 낱개
  })
})

describe('LOD — 같은 결정이면 화면을 다시 그리지 않는다', () => {
  it('펼친 공장 집합이 같으면 같은 결정으로 본다', () => {
    const a = { expanded: new Set(['PBS', 'GBS']), clusters: [] }
    const b = { expanded: new Set(['GBS', 'PBS']), clusters: [] }
    expect(sameLod(a, b)).toBe(true)
  })

  it('뱃지 자리만 다른 것은 같은 결정이다 — 자리는 매 프레임 바뀐다', () => {
    const a = { expanded: NONE, clusters: [{ factory: 'PBS', count: 3, sx: 10, sy: 10 }] }
    const b = { expanded: NONE, clusters: [{ factory: 'PBS', count: 3, sx: 90, sy: 40 }] }
    expect(sameLod(a, b)).toBe(true)
  })

  it('뱃지가 새로 생기거나 사라지면 다른 결정이다 — 처음 뭉치는 순간을 놓치지 않는다', () => {
    const none = { expanded: NONE, clusters: [] }
    const one = { expanded: NONE, clusters: [{ factory: 'PBS', count: 3, sx: 0, sy: 0 }] }
    expect(sameLod(none, one)).toBe(false)
    expect(sameLod(one, { expanded: NONE, clusters: [{ factory: 'GBS', count: 3, sx: 0, sy: 0 }] })).toBe(false)
  })

  it('하나라도 다르면 다른 결정이다', () => {
    const a = { expanded: new Set(['PBS']), clusters: [] }
    const b = { expanded: new Set(['GBS']), clusters: [] }
    expect(sameLod(a, b)).toBe(false)
    expect(sameLod(a, { expanded: new Set(['PBS', 'GBS']), clusters: [] })).toBe(false)
  })
})
