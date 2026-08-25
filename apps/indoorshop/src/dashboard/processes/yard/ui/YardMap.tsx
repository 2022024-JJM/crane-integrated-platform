import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { LatLon, YardBlock, YardLot, YardMove, YardPlan } from '../model/types'
import { quadContains } from '../model/types'
import { colorOfCategory, yardExtent } from '../api/yardRepository'
import { cn } from '../../../shared/lib/utils'
import { BASEMAP_LAYERS, SEA_COLOR, type BasemapLayer, type MapTheme } from '../lib/basemapStyle'
import { BAY_ROOF_ALPHA, BAY_WALL_ALPHA, BUILDING_EXTRUDE, RELIEF_METERS } from '../lib/relief'
import { bayColor, moveColor, paletteOf } from '../lib/yardColors'
import type { YardShop, YardShopBay } from '../lib/assemblyShops'
import { facilityContains, type YardFacility } from '../lib/facilities'
import { YardShopChips } from './YardShopChips'
import { YardFacilityLabels } from './YardFacilityLabels'
import {
  MAX_PITCH,
  MIN_TILTED_PITCH,
  TILTED_PITCH,
  clampScale,
  containsPoint,
  fitView,
  intersects,
  panBy,
  project,
  screenToWorld,
  visibleBounds,
  worldToScreen,
  wrapBearing,
  zoomAt,
  type ScreenPoint,
  type Viewport,
  type YardView,
  type YardViewMode,
} from '../lib/projection'

export interface YardLayers {
  basemap: boolean
  /** 공장·샵 41곳 — 공정색으로 발광하는 이 화면의 기본 무대 */
  facilities: boolean
  lots: boolean
  blocks: boolean
  /** 이동 실적 (from → to 경로) */
  moves: boolean
  /** 배정 계획 (목적지 지번) */
  plans: boolean
  /** 감시 대상 조립공장 (정반 단위) */
  shops: boolean
}

export interface YardMapProps {
  lots: YardLot[]
  blocks: YardBlock[]
  /** 고른 날의 이동 실적 — 색이 배열 순서로 돌아가므로 순서가 곧 신원이다 */
  moves: YardMove[]
  /** 고른 날의 배정 계획 */
  plans: YardPlan[]
  /**
   * 감시 대상 조립공장 — 정반이 야드에서 차지하는 지번까지 붙은 것.
   * 비어 있으면 이 레이어는 아무것도 그리지 않는다 (매핑이 덜 된 상태도 정상이다).
   */
  shops?: YardShop[]
  layers: YardLayers
  /** 베이스맵 밝기 — 배경이 바뀌면 그 위에 얹는 색도 함께 뒤집힌다 */
  mapTheme: MapTheme
  /** 평면으로 볼지 기울여 볼지 — 바뀌면 카메라가 그 자세까지 굴러간다 */
  viewMode: YardViewMode
  /** 지번 채움 불투명도 (0.05~0.9) — 베이스맵을 얼마나 비칠지 정한다 */
  lotOpacity: number
  /** 필터에서 빠진 지번 — 지우지 않고 흐리게 남긴다 (사라지면 야드 모양이 무너진다) */
  dimmedLots?: Set<string>
  selectedBlockId?: string | null
  /** 고른 이동 — `moves` 안의 자리. 하나를 고르면 나머지는 배경으로 물러난다 */
  selectedMoveIndex?: number | null
  /** 고른 정반 (locationId) */
  selectedBayId?: string | null
  hoveredLot?: string | null
  /** 손이 얹힌 정반 — 칩과 도형이 같이 밝아진다 */
  hoveredBayId?: string | null
  onSelectBlock?: (blockId: string | null) => void
  onSelectMove?: (index: number | null) => void
  onSelectBay?: (locationId: string | null) => void
  onHoverLot?: (lot: string | null) => void
  onHoverBay?: (locationId: string | null) => void
  onViewChange?: (view: YardView) => void
  /** 공장 화면 경로를 만드는 함수 — 맵은 앱의 라우팅 규칙을 알지 않는다 */
  shopHref?: (shop: YardShop) => string
  /** 정반 3D 화면 경로 */
  bayHref?: (bay: YardShopBay) => string
  /** 공장·샵 목록 — `layers.facilities` 가 켜져 있을 때 그린다 */
  facilities?: YardFacility[]
  /** 고른 공장 (이름이 곧 식별자) */
  selectedFacility?: string | null
  hoveredFacility?: string | null
  onSelectFacility?: (name: string | null) => void
  onHoverFacility?: (name: string | null) => void
  /** 공정 화면 경로 — 없는 공장(전처리·미지정)은 null 을 받아 링크를 만들지 않는다 */
  facilityHref?: (facility: YardFacility) => string | null
  /** 이 공장이 다 보이도록 맞춘다 (목록에서 고른 경우) */
  focusFacilityName?: string | null
  /**
   * 처음 열 때의 카메라 — 공정 화면에 다녀온 뒤 보던 자리로 되돌아오기 위한 것.
   * 없으면 야드 전체를 맞춘다. 기울기·방위는 viewMode 가 정하므로 받지 않는다.
   */
  initialView?: { centerLat: number; centerLon: number; scale: number } | null
  /** 이 신호가 바뀌면 야드 전체 보기로 되돌린다 */
  resetSignal?: number
  /** 이 블록이 화면 가운데 오도록 맞춘다 (목록에서 고른 경우) */
  focusBlockId?: string | null
  /** 이 이동 경로가 다 보이도록 맞춘다 (목록에서 고른 경우) */
  focusMoveIndex?: number | null
  className?: string
}

/** 블록 점 반지름(px) — 배율과 무관하게 일정해야 멀리서도 "여기 있다"가 보인다 */
const BLOCK_RADIUS = 3.5
const BLOCK_HIT_RADIUS = 9
/** 경로를 집는 반경(px) — 선은 2px 이라 그대로 두면 아무도 못 누른다 */
const MOVE_HIT_RADIUS = 10
/** 계획 목적지 점 반지름(px) */
const PLAN_RADIUS = 3
/** 이 배율(px/도) 위에서만 지번 이름을 그린다 — 아래에서는 글자가 겹쳐 회색 띠가 된다 */
const LABEL_MIN_SCALE = 500_000
/** 공장 외곽이 이만큼(px)은 되어야 모서리 표시를 그린다 — 작으면 표시가 도형을 먹는다 */
const BRACKET_MIN_SIZE = 44
/** 2D ↔ 3D 카메라가 굴러가는 시간(ms) — 순간이동하면 어디를 보고 있었는지 놓친다 */
const TILT_DURATION = 480
/* 기본값을 렌더마다 새로 만들지 않는다 — 다시 그리기 조건이 매 렌더 참이 되어 버린다 */
const NO_SHOPS: YardShop[] = []
const NO_FACILITIES: YardFacility[] = []

/** 손으로 돌릴 때의 감도 — 화면 1px 당 몇 도 */
const ORBIT_YAW_PER_PX = 0.28
const ORBIT_PITCH_PER_PX = 0.22

/**
 * 옥포 야드 맵.
 *
 * 베이스맵(OSM 벡터) 위에 지번 1,977개와 블록 669개를 겹쳐 그린다. SVG 로 두면
 * 노드가 8천 개가 되어 확대·이동마다 레이아웃이 돌지만, **캔버스는 보이는 것만
 * 그리면 된다** — 화면 밖 도형은 그리기 전에 버리므로 확대할수록 오히려 가벼워진다.
 *
 * 지번은 경계 상자가 아니라 **회전 사각형**으로 그린다. 옥포 야드는 안벽 방향을 따라
 * 구획이 돌아가 있어서, 상자로 그리면 서로 겹치고 없는 빈틈이 생긴다.
 *
 * 라벨·범례·상세는 캔버스가 아니라 DOM 으로 얹는다 (3D 뷰어와 같은 규칙) — 글자는
 * 브라우저가 그리는 편이 또렷하고, 테마·글자 크기 설정을 그대로 따른다.
 *
 * **2D 와 3D 는 같은 그림이다.** 기울기는 뷰(`YardView.pitch`)에만 있고 좌표 변환은
 * `projection` 한 곳에서 갈라지므로, 아래 코드는 대부분 기울기를 모른다. 3D 에서만
 * 다른 것은 딱 두 가지다: **세우는 것**(건물·정반·블록에 높이를 준다)과 **그리는
 * 순서**(가까운 것이 먼 것을 가려야 하므로 깊이로 정렬한다). Z 버퍼가 없는 캔버스에서
 * 순서는 곧 가림이라, 세운 것들은 반드시 뒤에서부터 그린다.
 */
export function YardMap({
  lots,
  blocks,
  moves,
  plans,
  shops = NO_SHOPS,
  layers,
  mapTheme,
  viewMode,
  lotOpacity,
  dimmedLots,
  selectedBlockId,
  selectedMoveIndex = null,
  selectedBayId = null,
  hoveredLot,
  hoveredBayId = null,
  onSelectBlock,
  onSelectMove,
  onSelectBay,
  onHoverLot,
  onHoverBay,
  onViewChange,
  shopHref,
  bayHref,
  facilities = NO_FACILITIES,
  selectedFacility = null,
  hoveredFacility = null,
  onSelectFacility,
  onHoverFacility,
  facilityHref,
  focusFacilityName = null,
  initialView = null,
  resetSignal = 0,
  focusBlockId,
  focusMoveIndex = null,
  className,
}: YardMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<YardView>({
    centerLat: 34.874,
    centerLon: 128.709,
    scale: 100_000,
    pitch: viewMode === '3d' ? TILTED_PITCH : 0,
    bearing: 0,
  })
  const viewportRef = useRef<Viewport>({ width: 0, height: 0 })
  const [cursor, setCursor] = useState<'grab' | 'grabbing' | 'pointer' | 'move'>('grab')
  /*
   * 맵 위의 DOM 칩(조립공장 이름줄·정반 칩)은 뷰가 바뀔 때마다 자리를 다시 잡아야 한다.
   * 뷰는 ref 에 있어서 바뀌어도 React 가 모르므로, 프레임당 한 번 이것으로 렌더를
   * 깨운다 — 값이 아니라 **신호**다. 칩은 열 개 남짓이라 프레임마다 그려도 싸다.
   */
  const [, bumpChips] = useReducer((tick: number) => tick + 1, 0)

  /* 콜백은 ref 로 받는다 — 부모가 매번 새 함수를 넘겨도 캔버스를 다시 묶지 않는다 */
  const handlers = useRef({
    onSelectBlock,
    onSelectMove,
    onSelectBay,
    onHoverLot,
    onHoverBay,
    onSelectFacility,
    onHoverFacility,
    onViewChange,
  })
  handlers.current = {
    onSelectBlock,
    onSelectMove,
    onSelectBay,
    onHoverLot,
    onHoverBay,
    onSelectFacility,
    onHoverFacility,
    onViewChange,
  }

  /* 그리기 입력도 ref 로 — draw 를 의존성 없는 안정된 함수로 유지한다 */
  const data = useRef({
    lots,
    blocks,
    moves,
    plans,
    shops,
    layers,
    mapTheme,
    lotOpacity,
    dimmedLots,
    selectedBlockId,
    selectedMoveIndex,
    selectedBayId,
    hoveredLot,
    hoveredBayId,
    facilities,
    selectedFacility,
    hoveredFacility,
  })
  data.current = {
    lots,
    blocks,
    moves,
    plans,
    shops,
    layers,
    mapTheme,
    lotOpacity,
    dimmedLots,
    selectedBlockId,
    selectedMoveIndex,
    selectedBayId,
    hoveredLot,
    hoveredBayId,
    facilities,
    selectedFacility,
    hoveredFacility,
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const view = viewRef.current
    const viewport = viewportRef.current
    const dpr = window.devicePixelRatio || 1
    const current = data.current
    const theme = current.mapTheme
    const palette = paletteOf(theme)
    /** 기울어져 있는가 — 세우기와 깊이 정렬은 이 값 하나로만 갈린다 */
    const tilted = view.pitch > 0

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    /* 캔버스 바탕은 바다다 — 육지는 베이스맵이 그 위에 덮는다 */
    ctx.fillStyle = SEA_COLOR[theme]
    ctx.fillRect(0, 0, viewport.width, viewport.height)

    const window_ = visibleBounds(view, viewport, 60)

    /** 위경도 + 고도(m) → 화면 */
    const at = (lat: number, lon: number, altitude = 0) =>
      worldToScreen(view, viewport, lat, lon, altitude)

    /** 화면 점 목록을 닫힌 경로로 — 세운 도형은 좌표를 두 벌 쓰므로 이 단계를 나눈다 */
    const traceScreen = (points: readonly ScreenPoint[]) => {
      ctx.beginPath()
      for (let i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(points[i].sx, points[i].sy)
        else ctx.lineTo(points[i].sx, points[i].sy)
      }
    }

    /** 링 하나를 경로로 옮긴다. GeoJSON 은 [lon, lat] 순서다 */
    const traceRing = (ring: readonly [number, number][]) => {
      ctx.beginPath()
      for (let i = 0; i < ring.length; i++) {
        const { sx, sy } = at(ring[i][1], ring[i][0])
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
    }

    /** 위경도 점 목록을 경로로 옮긴다 (지번·경로는 {lat, lon} 을 쓴다) */
    const tracePath = (points: readonly LatLon[]) => {
      ctx.beginPath()
      for (let i = 0; i < points.length; i++) {
        const { sx, sy } = at(points[i].lat, points[i].lon)
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
    }

    /** 링이 화면에 걸치는가 — 점을 하나씩 보는 것보다 훨씬 싸다 */
    const ringVisible = (ring: readonly [number, number][]) => {
      for (const [lon, lat] of ring) {
        if (containsPoint(window_, lat, lon)) return true
      }
      return false
    }

    /**
     * 밑면과 윗면 사이를 옆면으로 잇고 윗면을 덮는다 — 캔버스로 세우는 유일한 방법.
     *
     * 옆면을 **전부** 그린다. 뒷면은 나중에 그리는 윗면이 덮으므로(건물이 제 높이보다
     * 깊으면 언제나 그렇다) 뒷면을 골라내는 계산을 하지 않는 편이 싸고 안전하다.
     */
    const drawPrism = (
      base: readonly ScreenPoint[],
      top: readonly ScreenPoint[],
      style: { wall: string; wallEdge: string; roof: string; roofEdge: string }
    ) => {
      ctx.fillStyle = style.wall
      ctx.strokeStyle = style.wallEdge
      ctx.lineWidth = 0.6
      for (let i = 0; i < base.length; i++) {
        const j = (i + 1) % base.length
        ctx.beginPath()
        ctx.moveTo(base[i].sx, base[i].sy)
        ctx.lineTo(base[j].sx, base[j].sy)
        ctx.lineTo(top[j].sx, top[j].sy)
        ctx.lineTo(top[i].sx, top[i].sy)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }

      traceScreen(top)
      ctx.closePath()
      ctx.fillStyle = style.roof
      ctx.fill()
      ctx.strokeStyle = style.roofEdge
      ctx.lineWidth = 0.8
      ctx.stroke()
    }

    // ── 베이스맵 ──
    /*
     * 3D 에서는 건물만 빼 둔다. 건물은 지번 **위에** 서 있어야 하므로, 지번을 다 깐
     * 뒤에 세운다 — 순서를 바꾸지 않으면 건물 밑의 지번이 지붕 위로 떠오른다.
     */
    const standing: BasemapLayer[] = []
    if (current.layers.basemap) {
      for (const layer of BASEMAP_LAYERS[theme]) {
        if (layer.minScale && view.scale < layer.minScale) continue
        if (tilted && layer.kind === 'building') {
          standing.push(layer)
          continue
        }
        if (layer.fill) ctx.fillStyle = layer.fill
        if (layer.stroke) ctx.strokeStyle = layer.stroke
        ctx.lineWidth = layer.lineWidth ?? 1

        for (const ring of layer.rings) {
          if (!ringVisible(ring)) continue
          traceRing(ring)
          if (layer.closed) {
            ctx.closePath()
            if (layer.fill) ctx.fill()
            if (layer.stroke) ctx.stroke()
          } else if (layer.stroke) {
            ctx.stroke()
          }
        }
      }
    }

    // ── 지번 ──
    if (current.layers.lots) {
      for (const lot of current.lots) {
        if (!intersects(lot.bounds, window_)) continue
        const isDim = current.dimmedLots?.has(lot.lot) ?? false
        const color = colorOfCategory(lot.category)

        ctx.beginPath()
        for (let i = 0; i < lot.quad.length; i++) {
          const { sx, sy } = at(lot.quad[i].lat, lot.quad[i].lon)
          if (i === 0) ctx.moveTo(sx, sy)
          else ctx.lineTo(sx, sy)
        }
        ctx.closePath()

        ctx.globalAlpha = isDim ? current.lotOpacity * 0.15 : current.lotOpacity
        ctx.fillStyle = color
        ctx.fill()
        ctx.globalAlpha = isDim ? 0.15 : 0.9
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.globalAlpha = 1

        if (lot.lot === current.hoveredLot) {
          ctx.strokeStyle = palette.highlight
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }

      // 지번 이름 — 사각형이 글자를 담을 만큼 클 때만
      if (view.scale >= LABEL_MIN_SCALE) {
        ctx.fillStyle = palette.label
        ctx.font = '10px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        for (const lot of current.lots) {
          if (!intersects(lot.bounds, window_)) continue
          if (current.dimmedLots?.has(lot.lot)) continue
          const span = at(lot.bounds.minLat, lot.bounds.maxLon)
          const origin = at(lot.bounds.maxLat, lot.bounds.minLon)
          if (span.sx - origin.sx < 44 || span.sy - origin.sy < 14) continue
          const c = at(lot.center.lat, lot.center.lon)
          ctx.fillText(lot.lot, c.sx, c.sy)
        }
      }
    }

    // ── 건물 세우기 (3D 에서만) ──
    /*
     * 뒤에서부터 그린다 — 앞 건물이 뒷 건물을 가려야 어느 쪽이 가까운지 읽힌다.
     * 깊이는 링의 첫 꼭짓점 하나로 대신한다: 건물 하나는 화면에서 수십 px 이라,
     * 꼭짓점마다 재도 정렬 결과가 달라지지 않는다.
     */
    if (tilted) {
      const style = BUILDING_EXTRUDE[theme]
      for (const layer of standing) {
        const visible: { ring: readonly [number, number][]; depth: number }[] = []
        for (const ring of layer.rings) {
          if (ring.length < 3 || !ringVisible(ring)) continue
          visible.push({ ring, depth: project(view, viewport, ring[0][1], ring[0][0]).depth })
        }
        visible.sort((a, b) => b.depth - a.depth)

        for (const { ring } of visible) {
          const base = ring.map(([lon, lat]) => at(lat, lon))
          const top = ring.map(([lon, lat]) => at(lat, lon, RELIEF_METERS.building))
          drawPrism(base, top, style)
        }
      }
    }

    // ── 공장·샵 ──
    /*
     * 두 상태를 오간다 (레퍼런스 뷰어의 방식):
     *
     * **평상시** — 지번·블록이 주인공이므로 공장은 공정색 외곽선과 옅은 채움으로
     * "여기가 어느 공정의 공장"이라고만 말한다. 손이 얹히면 조금 밝아져 누를 수
     * 있음을 알린다.
     *
     * **공장을 고르면 네온** — 부모가 다른 레이어를 접고 베이스맵을 가라앉히면, 여기는
     * 공장만 발광시킨다. 외곽선은 무채색(어두운 지도에서 흰색)이고 색은 빛(그림자)으로만
     * 말한다 — 여섯 공정색이 나란히 있어도 시끄럽지 않으려면 그래야 한다. 고른 공장이
     * 가장 밝고 나머지는 어두워진다 — 발광은 상대적인 것이라, 전부 빛나면 아무것도
     * 빛나지 않는 것과 같다.
     */
    if (current.layers.facilities) {
      const selected = current.selectedFacility
      const neon = selected !== null
      for (const facility of current.facilities) {
        if (!intersects(facility.bounds, window_)) continue
        const color = facility.process.color[theme]
        const hovered = facility.name === current.hoveredFacility

        tracePath(facility.hull)
        ctx.closePath()

        if (!neon) {
          ctx.globalAlpha = hovered ? 0.3 : 0.13
          ctx.fillStyle = color
          ctx.fill()
          ctx.globalAlpha = hovered ? 1 : 0.75
          ctx.strokeStyle = color
          ctx.lineWidth = hovered ? 2.2 : 1.2
          ctx.stroke()
          ctx.globalAlpha = 1
          continue
        }

        const dim = facility.name !== selected
        if (!dim) {
          ctx.shadowColor = color
          ctx.shadowBlur = 26
        }
        ctx.globalAlpha = dim ? (hovered ? 0.2 : 0.08) : 0.52
        ctx.fillStyle = color
        ctx.fill()

        ctx.globalAlpha = dim ? (hovered ? 0.55 : 0.22) : 1
        ctx.strokeStyle = palette.highlight
        ctx.lineWidth = dim ? 1.6 : 2.6
        ctx.stroke()
        /* 한 번 더 긋는다 — 그림자가 누적되어 네온 관처럼 심지가 밝아진다 */
        if (!dim) ctx.stroke()

        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }
    }

    // ── 감시 대상 조립공장 ──
    /*
     * 정반 하나가 지번 구획 두세 개에 걸치므로 **채움 단위는 지번**이고, 그 구획들을
     * 감싸는 외곽선 한 겹이 "여기까지가 한 공장"이라고 말한다.
     *
     * 상태색은 정반만 갖는다 — 외곽선까지 색을 가지면 "공장 자체의 상태"라는 없는 뜻이
     * 생긴다. 외곽은 명도만으로 건물이라고 말하고, 색은 그 안의 정반이 쓴다.
     *
     * 지번 필터(흐리게)는 이 레이어에 걸지 않는다. 필터가 묻는 것은 "용도가 무엇인가"고
     * 이 레이어가 답하는 것은 "센서가 보고 있는가"라서, 서로 다른 질문이다.
     *
     * 3D 에서는 정반을 건물과 같은 높이로 세운다 — 건물 안에 파묻히면 감시 대상이라는
     * 이 레이어의 유일한 뜻이 사라진다. 공장 외곽은 세우지 않고 바닥 자국으로 남긴다:
     * 세운 것이 둘이면 어느 쪽이 정반인지 알 수 없다.
     */
    if (current.layers.shops) {
      for (const shop of current.shops) {
        if (!intersects(shop.bounds, window_)) continue

        /*
         * 순서가 곧 세기다: **바닥판 → 정반 → 외곽선.**
         * 판을 먼저 깔아 그 구역의 지번 색을 눌러 두어야 같은 정반 색이 진하게 서고,
         * 외곽선은 정반 위에 그어야 채움이 경계를 먹지 않는다.
         */
        tracePath(shop.hull)
        ctx.closePath()
        ctx.fillStyle = palette.shopPlate
        ctx.fill()

        /* 3D 에서는 정반도 깊이 순으로 — 앞 정반이 뒷 정반을 가려야 줄이 읽힌다 */
        const bays = tilted
          ? [...shop.bays].sort(
              (a, b) =>
                project(view, viewport, b.center.lat, b.center.lon).depth -
                project(view, viewport, a.center.lat, a.center.lon).depth
            )
          : shop.bays

        for (const bay of bays) {
          const active =
            bay.locationId === current.selectedBayId || bay.locationId === current.hoveredBayId
          const color = bayColor(bay.status, palette)

          for (const lot of bay.lots) {
            if (tilted) {
              const base = lot.quad.map((p) => at(p.lat, p.lon))
              const top = lot.quad.map((p) => at(p.lat, p.lon, RELIEF_METERS.bay))
              ctx.globalAlpha = active ? 1 : BAY_WALL_ALPHA
              drawPrism(base, top, {
                wall: color,
                wallEdge: palette.bayOutline,
                roof: color,
                roofEdge: palette.bayOutline,
              })
              /* 윗면만 한 겹 눌러 옆면과 갈라 놓는다 — 단색 덩어리는 부피로 안 읽힌다 */
              ctx.globalAlpha = active ? 0.32 : BAY_ROOF_ALPHA
              traceScreen(top)
              ctx.closePath()
              ctx.fillStyle = palette.bayOutline
              ctx.fill()
              ctx.globalAlpha = 1
              continue
            }

            tracePath(lot.quad)
            ctx.closePath()
            ctx.globalAlpha = active ? 0.88 : 0.62
            ctx.fillStyle = color
            ctx.fill()
            /* 테두리는 두 겹이다 — 바탕색 한 겹을 먼저 깔아야 어떤 지번 색 위에서도 경계가 산다 */
            ctx.globalAlpha = active ? 0.9 : 0.62
            ctx.strokeStyle = palette.bayOutline
            ctx.lineWidth = active ? 3.5 : 2.5
            ctx.stroke()
            ctx.globalAlpha = 1
            ctx.strokeStyle = color
            ctx.lineWidth = active ? 2 : 1.4
            ctx.stroke()
          }
        }

        /* 외곽선도 두 겹이다 — 바탕 한 겹을 깔아야 어떤 지번 색 위에서도 선이 끊기지 않는다 */
        tracePath(shop.hull)
        ctx.closePath()
        ctx.globalAlpha = 0.6
        ctx.strokeStyle = palette.bayOutline
        ctx.lineWidth = 4.5
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.strokeStyle = palette.shopHull
        ctx.lineWidth = 2
        ctx.stroke()

        /*
         * 모서리 표시 — 3D 뷰어가 블록 윤곽에 두르는 브래킷과 같은 모양이다.
         * 같은 신호를 두 화면이 같은 모양으로 쓰면 "이건 계측 대상"이라는 말을
         * 화면마다 새로 배우지 않아도 된다. 기울인 화면에서는 세운 정반의 꼭대기까지
         * 감싸야 하므로 바닥과 윗면을 함께 재서 상자를 잡는다.
         */
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const point of shop.hull) {
          const heights = tilted ? [0, RELIEF_METERS.bay] : [0]
          for (const height of heights) {
            const { sx, sy } = at(point.lat, point.lon, height)
            if (sx < minX) minX = sx
            if (sx > maxX) maxX = sx
            if (sy < minY) minY = sy
            if (sy > maxY) maxY = sy
          }
        }

        const shortSide = Math.min(maxX - minX, maxY - minY)
        if (shortSide >= BRACKET_MIN_SIZE) {
          const arm = Math.min(16, shortSide * 0.22)
          const corners = [
            [minX, minY, 1, 1],
            [maxX, minY, -1, 1],
            [minX, maxY, 1, -1],
            [maxX, maxY, -1, -1],
          ] as const
          ctx.strokeStyle = palette.shopHull
          ctx.lineCap = 'round'
          ctx.lineWidth = 2
          for (const [cx, cy, dx, dy] of corners) {
            ctx.beginPath()
            ctx.moveTo(cx, cy + dy * arm)
            ctx.lineTo(cx, cy)
            ctx.lineTo(cx + dx * arm, cy)
            ctx.stroke()
          }
          ctx.lineCap = 'butt'
        }
      }
    }

    // ── 배정 계획 ──
    /*
     * 계획을 실적보다 먼저 그린다 — 아직 일어나지 않은 것이 일어난 것을 덮으면
     * 무엇이 사실인지 헷갈린다. 계획은 목적지 점 하나로만 말한다: "여기에 넣기로 했다".
     */
    if (current.layers.plans) {
      ctx.strokeStyle = palette.plan
      ctx.fillStyle = palette.plan
      for (const plan of current.plans) {
        if (plan.path.length > 1) {
          ctx.globalAlpha = 0.5
          ctx.setLineDash([3, 5])
          ctx.lineWidth = 1.5
          tracePath(plan.path)
          ctx.stroke()
          ctx.setLineDash([])
        }
        if (!plan.at || !containsPoint(window_, plan.at.lat, plan.at.lon)) continue
        const { sx, sy } = at(plan.at.lat, plan.at.lon)
        ctx.globalAlpha = 0.62
        ctx.beginPath()
        ctx.arc(sx, sy, PLAN_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // ── 이동 실적 ──
    /*
     * 하루 54건이 한꺼번에 진하게 깔리면 야드가 실뭉치가 된다. 그래서 평상시에는
     * **아주 흐린 실선**으로 "여기에 길이 있었다"만 남기고, 하나를 고르면 그것만
     * 제 색을 되찾는다 — 나머지는 더 흐려져 배경으로 물러난다.
     *
     * 경로는 3D 에서도 지면에 붙인다. 띄우면 그림자가 없는 화면에서 어느 길 위를
     * 지났는지 알 수 없게 되고, 이 레이어가 답하려는 질문이 바로 그것이다.
     */
    if (current.layers.moves) {
      const selected = current.selectedMoveIndex
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      current.moves.forEach((move, index) => {
        if (index === selected) return
        if (!intersects(move.bounds, window_)) return
        ctx.globalAlpha = selected === null ? 0.34 : 0.1
        ctx.strokeStyle = moveColor(index, theme)
        ctx.lineWidth = 2
        tracePath(move.path)
        ctx.stroke()
      })

      if (selected !== null && current.moves[selected]) {
        const move = current.moves[selected]
        const color = moveColor(selected, theme)

        ctx.globalAlpha = 1
        ctx.strokeStyle = palette.moveHalo
        ctx.lineWidth = 7
        tracePath(move.path)
        ctx.stroke()

        ctx.strokeStyle = color
        ctx.lineWidth = 3.5
        /* 도로가 매핑되지 않은 구간은 점선이다 — 그은 선이 추정임을 선 모양이 말한다 */
        if (!move.onRoad) ctx.setLineDash([3, 6])
        tracePath(move.path)
        ctx.stroke()
        ctx.setLineDash([])

        const ends: [LatLon, number][] = [
          [move.path[0], 5],
          [move.path[move.path.length - 1], 6.5],
        ]
        for (const [point, radius] of ends) {
          if (!point) continue
          const { sx, sy } = at(point.lat, point.lon)
          ctx.beginPath()
          ctx.arc(sx, sy, radius, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = palette.moveHalo
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
      ctx.lineJoin = 'miter'
      ctx.lineCap = 'butt'
    }

    // ── 블록 ──
    /*
     * 3D 에서는 점을 띄우고 지면까지 기둥을 내린다. 기울인 화면에서 떠 있는 점은
     * **어느 지번 위인지 말하지 못한다** — 같은 화면 자리가 "가까운 땅"도 되고
     * "먼 땅 위 공중"도 되기 때문이다. 기둥의 밑동이 그 답을 대신한다.
     */
    if (current.layers.blocks) {
      const altitude = tilted ? RELIEF_METERS.block : 0
      const visible = current.blocks.filter((block) =>
        containsPoint(window_, block.lat, block.lon)
      )
      if (tilted) {
        visible.sort(
          (a, b) =>
            project(view, viewport, b.lat, b.lon).depth - project(view, viewport, a.lat, a.lon).depth
        )
      }

      for (const block of visible) {
        const head = at(block.lat, block.lon, altitude)
        const selected = block.id === current.selectedBlockId

        if (tilted) {
          const foot = at(block.lat, block.lon)
          ctx.beginPath()
          ctx.moveTo(foot.sx, foot.sy)
          ctx.lineTo(head.sx, head.sy)
          ctx.strokeStyle = selected ? palette.blockSelected : palette.block
          ctx.globalAlpha = selected ? 0.9 : 0.5
          ctx.lineWidth = selected ? 1.6 : 1
          ctx.stroke()
          ctx.globalAlpha = 1

          ctx.beginPath()
          ctx.arc(foot.sx, foot.sy, 1.5, 0, Math.PI * 2)
          ctx.fillStyle = palette.blockOutline
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(head.sx, head.sy, selected ? BLOCK_RADIUS + 2 : BLOCK_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = selected ? palette.blockSelected : palette.block
        ctx.fill()
        /* 어두운 테두리 한 겹 — 밝은 지번 위에서도 점이 떠 보이게 한다 */
        ctx.lineWidth = 1
        ctx.strokeStyle = palette.blockOutline
        ctx.stroke()

        if (selected) {
          ctx.beginPath()
          ctx.arc(head.sx, head.sy, BLOCK_RADIUS + 7, 0, Math.PI * 2)
          ctx.strokeStyle = palette.blockSelected
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }
    }
  }, [])

  /*
   * 뷰 상태를 바깥으로 흘릴 때는 프레임당 한 번으로 눌러 담는다.
   * 드래그는 pointermove 마다 들어오는데, 그때마다 부모가 다시 그리면 옆의 목록
   * (수백 줄)까지 같이 다시 그려진다 — 캔버스는 멀쩡한데 화면이 끈적해진다.
   */
  const publishFrame = useRef(0)
  const publishView = useCallback(() => {
    if (publishFrame.current) return
    publishFrame.current = requestAnimationFrame(() => {
      publishFrame.current = 0
      handlers.current.onViewChange?.({ ...viewRef.current })
      /* 맵 위 칩도 같은 프레임에 자리를 다시 잡는다 (캔버스와 한 박자로 움직이도록) */
      bumpChips()
    })
  }, [])

  /*
   * 예약을 취소했으면 **자리도 비워야 한다.** 취소만 하고 id 를 남겨 두면 다음 마운트의
   * publishView 가 "이미 예약돼 있다"고 보고 영영 되돌아 나간다 — 개발 모드(StrictMode)의
   * 두 번 마운트에서 좌표 표시가 끝까지 뜨지 않던 원인이다.
   */
  useEffect(
    () => () => {
      cancelAnimationFrame(publishFrame.current)
      publishFrame.current = 0
    },
    []
  )

  /* 최초 한 번만 쓰는 값 — ref 로 잡아 두면 이후 갱신이 카메라를 다시 끌고 가지 않는다 */
  const initialViewRef = useRef(initialView)

  const fitToYard = useCallback(() => {
    if (viewportRef.current.width === 0) return
    /* 전체 보기는 방위도 북쪽으로 되돌린다 — "집"이 매번 다른 방향이면 집이 아니다 */
    viewRef.current = fitView(yardExtent(), viewportRef.current, 0.05, {
      pitch: viewRef.current.pitch,
      bearing: 0,
    })
  }, [])

  // ── 크기 추적 + 최초 맞춤 ──
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    let initialised = false
    const resize = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dpr = window.devicePixelRatio || 1
      viewportRef.current = { width: rect.width, height: rect.height }
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      if (!initialised) {
        initialised = true
        /* 공정 화면에 다녀온 자리가 있으면 거기로 — 없으면 야드 전체를 맞춘다 */
        if (initialViewRef.current) {
          viewRef.current = {
            ...viewRef.current,
            ...initialViewRef.current,
            scale: clampScale(initialViewRef.current.scale),
          }
        } else {
          fitToYard()
        }
        publishView()
      }
      draw()
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [draw, publishView, fitToYard])

  // 데이터·표시 설정이 바뀌면 다시 그린다
  useEffect(() => {
    draw()
  }, [
    draw,
    lots,
    blocks,
    moves,
    plans,
    shops,
    layers,
    mapTheme,
    lotOpacity,
    dimmedLots,
    selectedBlockId,
    selectedMoveIndex,
    selectedBayId,
    hoveredLot,
    hoveredBayId,
    facilities,
    selectedFacility,
    hoveredFacility,
  ])

  /*
   * 2D ↔ 3D — 카메라를 굴려서 간다.
   *
   * 순간이동시키면 같은 야드인데도 다른 화면으로 갈아탄 것처럼 보여서, 보고 있던
   * 자리를 눈으로 다시 찾아야 한다. 반 초 동안 기울어지는 동안 눈이 그 자리를 따라간다.
   * 3D 를 벗어날 때는 방위도 북쪽으로 되돌린다 — 2D 는 "북쪽이 위"인 지도라는 약속이다.
   */
  useEffect(() => {
    const targetPitch = viewMode === '3d' ? TILTED_PITCH : 0
    const targetBearing = viewMode === '3d' ? viewRef.current.bearing : 0
    const fromPitch = viewRef.current.pitch
    const fromBearing = viewRef.current.bearing
    if (fromPitch === targetPitch && fromBearing === targetBearing) return

    const settle = () => {
      viewRef.current = { ...viewRef.current, pitch: targetPitch, bearing: targetBearing }
      publishView()
      draw()
    }

    /* 움직임을 줄여 달라고 한 사람에게는 굴리지 않는다 — 그 설정의 뜻이 그것이다 */
    if (
      viewportRef.current.width === 0 ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      settle()
      return
    }

    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / TILT_DURATION)
      /* ease-in-out — 시작과 끝이 부드러워야 "굴러갔다"로 읽힌다 */
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      viewRef.current = {
        ...viewRef.current,
        pitch: fromPitch + (targetPitch - fromPitch) * eased,
        bearing: fromBearing + (targetBearing - fromBearing) * eased,
      }
      publishView()
      draw()
      if (t < 1) frame = requestAnimationFrame(step)
      else settle()
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [viewMode, draw, publishView])

  useEffect(() => {
    if (resetSignal === 0) return
    fitToYard()
    publishView()
    draw()
  }, [resetSignal, draw, publishView, fitToYard])

  // 목록에서 고른 블록으로 이동 — 지번이 읽힐 만큼은 당긴다
  useEffect(() => {
    if (!focusBlockId || viewportRef.current.width === 0) return
    const target = data.current.blocks.find((b) => b.id === focusBlockId)
    if (!target) return
    viewRef.current = {
      ...viewRef.current,
      centerLat: target.lat,
      centerLon: target.lon,
      scale: Math.max(viewRef.current.scale, 600_000),
    }
    publishView()
    draw()
  }, [focusBlockId, draw, publishView])

  // 목록에서 고른 공장 — 이웃 공장과의 관계가 남을 만큼 여백을 두고 맞춘다
  useEffect(() => {
    if (!focusFacilityName || viewportRef.current.width === 0) return
    const target = data.current.facilities.find((f) => f.name === focusFacilityName)
    if (!target) return
    viewRef.current = fitView(target.bounds, viewportRef.current, 0.32, viewRef.current)
    publishView()
    draw()
  }, [focusFacilityName, draw, publishView])

  // 목록에서 고른 이동 — 출발과 도착이 한 화면에 다 들어와야 "어디서 어디로"가 읽힌다
  useEffect(() => {
    if (focusMoveIndex === null || viewportRef.current.width === 0) return
    const move = data.current.moves[focusMoveIndex]
    if (!move || move.path.length === 0) return
    viewRef.current = fitView(move.bounds, viewportRef.current, 0.22, viewRef.current)
    publishView()
    draw()
  }, [focusMoveIndex, draw, publishView])

  // ── 조작: 끌어서 이동, 휠로 확대, (3D) Shift·오른쪽 끌기로 돌리기 ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let dragging = false
    let orbiting = false
    let moved = false
    let lastX = 0
    let lastY = 0

    /** 블록 표시가 떠 있는 높이 — 그리는 자리와 집는 자리가 같아야 한다 */
    const blockAltitude = () => (viewRef.current.pitch > 0 ? RELIEF_METERS.block : 0)

    const pickBlock = (sx: number, sy: number): YardBlock | null => {
      if (!data.current.layers.blocks) return null
      const view = viewRef.current
      const viewport = viewportRef.current
      const altitude = blockAltitude()
      let best: YardBlock | null = null
      let bestDist = BLOCK_HIT_RADIUS * BLOCK_HIT_RADIUS
      for (const block of data.current.blocks) {
        const p = worldToScreen(view, viewport, block.lat, block.lon, altitude)
        const dx = p.sx - sx
        const dy = p.sy - sy
        const dist = dx * dx + dy * dy
        if (dist <= bestDist) {
          bestDist = dist
          best = block
        }
      }
      return best
    }

    /** 점에서 선분까지의 거리² — 경로는 선이라 "가까운 점"이 아니라 "가까운 선"을 찾아야 한다 */
    const distToSegment = (
      px: number,
      py: number,
      ax: number,
      ay: number,
      bx: number,
      by: number
    ): number => {
      const dx = bx - ax
      const dy = by - ay
      const lenSq = dx * dx + dy * dy
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
      const ex = px - (ax + t * dx)
      const ey = py - (ay + t * dy)
      return ex * ex + ey * ey
    }

    const pickMove = (sx: number, sy: number): number | null => {
      if (!data.current.layers.moves) return null
      const view = viewRef.current
      const viewport = viewportRef.current
      const window_ = visibleBounds(view, viewport, MOVE_HIT_RADIUS)
      let best: number | null = null
      let bestDist = MOVE_HIT_RADIUS * MOVE_HIT_RADIUS
      data.current.moves.forEach((move, index) => {
        if (!intersects(move.bounds, window_)) return
        for (let i = 0; i + 1 < move.path.length; i++) {
          const a = worldToScreen(view, viewport, move.path[i].lat, move.path[i].lon)
          const b = worldToScreen(view, viewport, move.path[i + 1].lat, move.path[i + 1].lon)
          const dist = distToSegment(sx, sy, a.sx, a.sy, b.sx, b.sy)
          if (dist <= bestDist) {
            bestDist = dist
            best = index
          }
        }
      })
      return best
    }

    const pickLot = (sx: number, sy: number): YardLot | null => {
      if (!data.current.layers.lots) return null
      const { lat, lon } = screenToWorld(viewRef.current, viewportRef.current, sx, sy)
      /* 겹친 지번이 있으면 작은 쪽을 고른다 — 큰 구역 안에 작은 구획이 들어 있다 */
      let best: YardLot | null = null
      let bestArea = Infinity
      for (const lot of data.current.lots) {
        if (!containsPoint(lot.bounds, lat, lon)) continue
        if (!quadContains(lot.quad, lat, lon)) continue
        if (lot.area > 0 && lot.area < bestArea) {
          bestArea = lot.area
          best = lot
        } else if (!best) {
          best = lot
        }
      }
      return best
    }

    /**
     * 커서 아래의 감시 정반 — 지번 구획 단위로 판정한다.
     *
     * 정반은 지번 여러 개로 이루어지고 지번은 회전 사각형이라, 경계 상자로 판정하면
     * 옆 정반을 집는다. 상자로 먼저 걸러 낸 뒤 사각형 안쪽만 인정한다.
     *
     * 판정은 3D 에서도 **지면 기준**이다 — 세운 옆면을 눌러도 그 밑동의 지번을
     * 고르게 되므로, 손이 가리키는 것과 고르는 것이 어긋나지 않는다.
     */
    const pickBay = (sx: number, sy: number): YardShopBay | null => {
      if (!data.current.layers.shops) return null
      const { lat, lon } = screenToWorld(viewRef.current, viewportRef.current, sx, sy)
      for (const shop of data.current.shops) {
        if (!containsPoint(shop.bounds, lat, lon)) continue
        for (const bay of shop.bays) {
          if (!containsPoint(bay.bounds, lat, lon)) continue
          for (const lot of bay.lots) {
            if (containsPoint(lot.bounds, lat, lon) && quadContains(lot.quad, lat, lon)) return bay
          }
        }
      }
      return null
    }

    /**
     * 커서 아래의 공장 — 샵 내비 모드에서만. 겹치는 외곽이 있으면(붙은 공장들)
     * 화면상 더 작은 쪽이 이긴다 — 큰 것이 이기면 작은 공장은 영원히 못 누른다.
     */
    const pickFacility = (sx: number, sy: number): YardFacility | null => {
      if (!data.current.layers.facilities) return null
      const { lat, lon } = screenToWorld(viewRef.current, viewportRef.current, sx, sy)
      let best: YardFacility | null = null
      let bestSpan = Infinity
      for (const facility of data.current.facilities) {
        if (!containsPoint(facility.bounds, lat, lon)) continue
        if (!facilityContains(facility, lat, lon)) continue
        const span =
          (facility.bounds.maxLat - facility.bounds.minLat) *
          (facility.bounds.maxLon - facility.bounds.minLon)
        if (span < bestSpan) {
          bestSpan = span
          best = facility
        }
      }
      return best
    }

    const localPoint = (event: PointerEvent | WheelEvent | MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { sx: event.clientX - rect.left, sy: event.clientY - rect.top }
    }

    /** 돌리기는 기울어져 있을 때만 뜻이 있다 — 평면을 돌리면 북쪽만 잃는다 */
    const wantsOrbit = (event: PointerEvent) =>
      viewRef.current.pitch > 0 && (event.button === 2 || event.shiftKey)

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 2) return
      canvas.setPointerCapture(event.pointerId)
      dragging = true
      orbiting = wantsOrbit(event)
      moved = false
      lastX = event.clientX
      lastY = event.clientY
      setCursor(orbiting ? 'move' : 'grabbing')
    }

    const onPointerMove = (event: PointerEvent) => {
      const { sx, sy } = localPoint(event)

      if (dragging) {
        const dx = event.clientX - lastX
        const dy = event.clientY - lastY
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true
        lastX = event.clientX
        lastY = event.clientY
        if (orbiting) {
          const view = viewRef.current
          viewRef.current = {
            ...view,
            bearing: wrapBearing(view.bearing + dx * ORBIT_YAW_PER_PX),
            /* 3D 안에서는 완전히 눕지도 완전히 서지도 못한다 — 그러면 모드와 화면이 어긋난다 */
            pitch: Math.min(
              MAX_PITCH,
              Math.max(MIN_TILTED_PITCH, view.pitch - dy * ORBIT_PITCH_PER_PX)
            ),
          }
        } else {
          viewRef.current = panBy(viewRef.current, viewportRef.current, dx, dy)
        }
        publishView()
        draw()
        return
      }

      /* 작은 것 우선 — 점(블록)·면(정반)이 먼저고, 공장은 가장 큰 면이라 마지막이다 */
      const block = pickBlock(sx, sy)
      const bay = block ? null : pickBay(sx, sy)
      const facility = block || bay ? null : pickFacility(sx, sy)
      setCursor(block || bay || facility || pickMove(sx, sy) !== null ? 'pointer' : 'grab')
      handlers.current.onHoverLot?.(block?.lot ?? pickLot(sx, sy)?.lot ?? null)
      handlers.current.onHoverBay?.(bay?.locationId ?? null)
      handlers.current.onHoverFacility?.(facility?.name ?? null)
    }

    const onPointerUp = (event: PointerEvent) => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      const wasDragging = dragging
      const wasOrbiting = orbiting
      dragging = false
      orbiting = false
      setCursor('grab')
      if (!wasDragging || moved || wasOrbiting) return

      /*
       * 끌지 않고 눌렀다 뗐다 = 선택. 작은 것이 먼저다 — 점(블록)·선(경로)·면(정반)
       * 순으로 본다. 같은 자리를 두고 다투면 큰 것이 언제나 이겨서, 면을 먼저 보면
       * 정반 위에 세워진 블록은 영원히 못 누른다. 빈 곳을 누르면 전부 해제다.
       */
      const { sx, sy } = localPoint(event)
      const block = pickBlock(sx, sy)
      if (block) {
        handlers.current.onSelectBlock?.(block.id)
        return
      }
      const move = pickMove(sx, sy)
      if (move !== null) {
        handlers.current.onSelectMove?.(move)
        return
      }
      const bay = pickBay(sx, sy)
      if (bay) {
        handlers.current.onSelectBay?.(bay.locationId)
        return
      }
      /* 공장은 마지막 — 블록·정반이 그 위에 서 있어서, 먼저 보면 그것들을 영영 못 누른다 */
      const facility = pickFacility(sx, sy)
      if (facility) {
        handlers.current.onSelectFacility?.(facility.name)
        return
      }
      handlers.current.onSelectFacility?.(null)
      handlers.current.onSelectBlock?.(null)
      handlers.current.onSelectMove?.(null)
      handlers.current.onSelectBay?.(null)
    }

    const onPointerLeave = () => {
      if (dragging) return
      handlers.current.onHoverLot?.(null)
      handlers.current.onHoverBay?.(null)
      handlers.current.onHoverFacility?.(null)
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const { sx, sy } = localPoint(event)
      /* 휠 한 칸에 약 1.15배 — 트랙패드의 작은 델타도 같은 식으로 눌러 담는다 */
      viewRef.current = zoomAt(
        viewRef.current,
        viewportRef.current,
        sx,
        sy,
        Math.exp(-event.deltaY * 0.0015)
      )
      publishView()
      draw()
    }

    const onDoubleClick = (event: MouseEvent) => {
      const { sx, sy } = localPoint(event)
      viewRef.current = zoomAt(viewRef.current, viewportRef.current, sx, sy, 1.8)
      publishView()
      draw()
    }

    /* 오른쪽 끌기가 돌리기이므로 메뉴는 막는다 — 안 막으면 한 번 돌리고 메뉴가 뜬다 */
    const onContextMenu = (event: MouseEvent) => {
      if (viewRef.current.pitch > 0) event.preventDefault()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('dblclick', onDoubleClick)
    canvas.addEventListener('contextmenu', onContextMenu)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('dblclick', onDoubleClick)
      canvas.removeEventListener('contextmenu', onContextMenu)
    }
  }, [draw, publishView])

  // 키보드 — 커서가 맵 위에 있을 때만 (뷰포트 단축키와 같은 규칙)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!containerRef.current?.matches(':hover')) return
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return

      const step = event.shiftKey ? 1.6 : 1.25
      if (event.key === '+' || event.key === '=') {
        viewRef.current = { ...viewRef.current, scale: clampScale(viewRef.current.scale * step) }
      } else if (event.key === '-' || event.key === '_') {
        viewRef.current = { ...viewRef.current, scale: clampScale(viewRef.current.scale / step) }
      } else if (event.key === 'Escape') {
        handlers.current.onSelectBlock?.(null)
        handlers.current.onSelectMove?.(null)
        handlers.current.onSelectBay?.(null)
        handlers.current.onSelectFacility?.(null)
        return
      } else {
        return
      }
      event.preventDefault()
      publishView()
      draw()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [draw, publishView])

  /*
   * 공장 이름줄을 누르면 그 공장이 다 보이도록 맞춘다 — 카메라만 움직이는 일이라
   * 바깥 상태를 거치지 않는다. 멀리서는 정반 칩이 뜨지 않으므로, 이 한 번의 확대가
   * "이름줄 → 정반 칩 → 3D 화면"으로 이어지는 첫 걸음이 된다.
   */
  const focusShop = useCallback(
    (shop: YardShop) => {
      if (viewportRef.current.width === 0) return
      viewRef.current = fitView(shop.bounds, viewportRef.current, 0.18, viewRef.current)
      publishView()
      draw()
    },
    [draw, publishView],
  )

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden rounded-inshop-lg', className)}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none select-none"
        style={{ cursor }}
      />

      {layers.facilities && facilities.length > 0 && (
        <YardFacilityLabels
          facilities={facilities}
          view={viewRef.current}
          viewport={viewportRef.current}
          mapTheme={mapTheme}
          selectedFacility={selectedFacility}
          hoveredFacility={hoveredFacility}
          onSelectFacility={onSelectFacility}
          onHoverFacility={onHoverFacility}
          facilityHref={facilityHref}
        />
      )}

      {shops.length > 0 && layers.shops && shopHref && bayHref && (
        <YardShopChips
          shops={shops}
          view={viewRef.current}
          viewport={viewportRef.current}
          mapTheme={mapTheme}
          selectedBayId={selectedBayId}
          hoveredBayId={hoveredBayId}
          onHoverBay={onHoverBay}
          onFocusShop={focusShop}
          shopHref={shopHref}
          bayHref={bayHref}
        />
      )}
    </div>
  )
}
