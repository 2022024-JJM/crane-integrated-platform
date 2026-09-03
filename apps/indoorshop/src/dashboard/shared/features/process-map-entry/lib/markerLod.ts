import { worldToScreen, type Viewport, type YardView } from '../../yard-map'
import type { MapEntryMarker } from '../model/types'

/*
 * 마커 **LOD**(level of detail) — 멀리서는 뭉치고, 가까이서는 전부 편다.
 *
 * 조립 화면은 설비 마커를 465개까지 세운다. 야드 전체가 보이는 자리에서 그 465개는 몇
 * 픽셀 안에 겹쳐 서서 **점 하나의 얼룩**으로 보이는데, 브라우저는 그 얼룩을 위해 465개의
 * DOM 노드를 만들고 매 프레임 465번 transform 을 쓴다 — 보이지도 않는 것에 드는 값이다.
 *
 * 그래서 겹쳐 서는 공장의 마커는 **공장 하나짜리 집계 뱃지**로 접는다. 판단 기준은 배율
 * 숫자가 아니라 **화면에서 실제로 얼마나 벌어져 있는가**다(공장마다 크기가 다르고, 야드
 * 배율의 절대값은 화면 크기에 따라 달라진다).
 *
 * 지키는 것 둘:
 *  1. **누를 수 있는 마커는 절대 접지 않는다.** 드릴인한 공장(=유일하게 클릭 가능한 공장)의
 *     마커는 언제나 낱개로 선다 — 클릭 동작이 배율에 따라 달라지면 그건 성능이 아니라 버그다.
 *  2. **경계에서 떨리지 않는다.** 펴는 문턱과 접는 문턱을 벌려 둔다(히스테리시스) — 한 픽셀
 *     차이로 뱃지와 마커가 번갈아 뜨면 그게 제일 거슬린다.
 */

/** 공장 하나로 접힌 마커 뭉치 */
export interface MarkerCluster {
  factory: string
  /** 접힌 마커 수 — 뱃지에 그대로 적는다 */
  count: number
  /** 접힌 마커들의 화면 좌표 중심 (뱃지가 설 자리) */
  sx: number
  sy: number
}

export interface MarkerLodInput<M extends MapEntryMarker> {
  markers: readonly M[]
  view: YardView
  viewport: Viewport
  /** 이 공장의 마커는 접지 않는다 (드릴인한 공장 = 유일하게 누를 수 있는 공장) */
  keepFactory: string | null
  /** 마커가 얹히는 높이(m) — 지도와 같은 값을 써야 뱃지가 마커 자리에 선다 */
  altitude: number
  /** 지금 펼쳐져 있는 공장들 — 히스테리시스의 기준 */
  expanded: ReadonlySet<string>
}

export interface MarkerLodResult {
  /** 낱개로 세울 공장 — 이 공장의 마커만 DOM 에 만든다 */
  expanded: Set<string>
  /** 접힌 공장의 뱃지 */
  clusters: MarkerCluster[]
}

/** 펼치는 문턱: 마커들이 이만큼(px) 이상 벌어져 있으면 낱개로 볼 만하다 */
export const EXPAND_SPREAD_PX = 150
/** 접는 문턱: 이보다 좁아지면 다시 뭉친다. 펴는 문턱보다 낮게 둬 경계에서 떨지 않는다 */
export const COLLAPSE_SPREAD_PX = 110

/**
 * 지금 카메라에서 어떤 공장을 펴고 어떤 공장을 접을지 정한다.
 *
 * 순수 함수다 — 투영 말고는 아무것도 모른다. 그래서 브라우저 없이 검증할 수 있고,
 * 화면은 이 결과를 그리기만 한다.
 */
export function resolveMarkerLod<M extends MapEntryMarker>({
  markers,
  view,
  viewport,
  keepFactory,
  altitude,
  expanded: wasExpanded,
}: MarkerLodInput<M>): MarkerLodResult {
  const byFactory = new Map<string, { sx: number; sy: number }[]>()
  for (const marker of markers) {
    const { sx, sy } = worldToScreen(view, viewport, marker.lat, marker.lon, altitude)
    const list = byFactory.get(marker.factory)
    if (list) list.push({ sx, sy })
    else byFactory.set(marker.factory, [{ sx, sy }])
  }

  const expanded = new Set<string>()
  const clusters: MarkerCluster[] = []

  for (const [factory, points] of byFactory) {
    /* 누를 수 있는 공장은 판단 없이 편다 */
    if (factory === keepFactory) {
      expanded.add(factory)
      continue
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let sumX = 0
    let sumY = 0
    for (const { sx, sy } of points) {
      minX = Math.min(minX, sx)
      maxX = Math.max(maxX, sx)
      minY = Math.min(minY, sy)
      maxY = Math.max(maxY, sy)
      sumX += sx
      sumY += sy
    }
    const spread = Math.hypot(maxX - minX, maxY - minY)
    /* 히스테리시스 — 지금 펴져 있으면 더 좁아져야 접고, 접혀 있으면 더 벌어져야 편다 */
    const threshold = wasExpanded.has(factory) ? COLLAPSE_SPREAD_PX : EXPAND_SPREAD_PX
    if (spread >= threshold) {
      expanded.add(factory)
      continue
    }
    clusters.push({
      factory,
      count: points.length,
      sx: sumX / points.length,
      sy: sumY / points.length,
    })
  }

  return { expanded, clusters }
}

/**
 * 두 결정이 같은가 — 같으면 React 를 깨우지 않는다(매 프레임 리렌더를 막는 문지기).
 *
 * **자리(sx·sy)는 비교하지 않는다.** 뱃지 자리는 카메라를 따라 매 프레임 바뀌지만 그건
 * transform 으로 밀어 넣는 값이고, 여기서 묻는 것은 "무엇이 서는가"다. 대신 접힌 공장의
 * **구성**은 본다 — 처음 뭉칠 때는 펼친 집합이 둘 다 비어 있어서, 그것만 보면 뱃지가
 * 생겼다는 사실을 놓친다.
 */
export function sameLod(a: MarkerLodResult, b: MarkerLodResult): boolean {
  if (a.expanded.size !== b.expanded.size) return false
  for (const factory of a.expanded) if (!b.expanded.has(factory)) return false
  if (a.clusters.length !== b.clusters.length) return false
  const keys = new Set(b.clusters.map((cluster) => cluster.factory))
  for (const cluster of a.clusters) if (!keys.has(cluster.factory)) return false
  return true
}
