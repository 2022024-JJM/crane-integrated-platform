import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import {
  RELIEF_METERS,
  worldToScreen,
  type YardView,
  type Viewport,
} from '../../yard-map'
import type { YardParcelFactory } from '../../../entities/yard-parcels'
import { cn } from '../../../lib/utils'
import type { MapEntryMarker, MarkerRenderCtx } from '../model/types'
import type { ReactNode } from 'react'

/*
 * ── 카메라를 따라가는 DOM 층 (마커 + 공장 이름 라벨) — 공정 무관 골격 ──
 *
 * 카메라는 비행·드래그 중 **매 프레임** 바뀐다. 뷰를 프레임의 state 로 들면 프레임마다
 * 우측 패널·상세 오버레이까지 통째로 리렌더돼 애니메이션이 뚝뚝 끊긴다. 그래서 뷰는 이
 * 층만 아는 상태로 내리고, 지도는 imperative handle 로 밀어 넣는다 — 미니맵과 같은 결이다.
 *
 * 카메라는 **state 로 들지 않는다.** 마커가 수십 개라 프레임마다 다시 그리면 React 가
 * 그 수만큼 엘리먼트를 새로 만들고, `left/top` 을 고치면 브라우저가 레이아웃을 그 수만큼
 * 다시 잰다. 그래서 카메라는 ref 로 받고, 자리는 **DOM 노드의 transform 에 직접** 쓴다.
 * React 가 다시 그리는 것은 자료(마커·선택)가 바뀔 때뿐이고, 매 프레임 하는 일은
 * transform 쓰기다(레이아웃 없이 합성만 다시 한다). **마커의 생김새는 이 층의 몫이
 * 아니다** — `renderMarker` 가 그린다(공정 몫).
 */

/** 마커가 얹히는 높이 — 베이 지붕 언저리 (박공 지붕 위 잣대, 도장 화면 원값) */
const MARKER_METERS = RELIEF_METERS.parcel * 1.4
/** 공장 이름이 뜨는 높이 — 지붕 위. 떠 있는 이름패(FactoryHudLabel)와 같은 높이다 */
const NAME_METERS = RELIEF_METERS.parcel * 2.2

export interface MapMarkerLayerHandle {
  update: (view: YardView) => void
}

interface MapMarkerLayerProps<M extends MapEntryMarker> {
  markers: readonly M[]
  selectedMarkerId: string | null
  onSelectMarker: (id: string | null) => void
  renderMarker: (marker: M, ctx: MarkerRenderCtx) => ReactNode
  selectedFactory: string
  inOverview: boolean
  hoveredFactory: string | null
  memberFactories: readonly YardParcelFactory[]
  accentByName: ReadonlyMap<string, string>
  viewport: Viewport
}

function MapMarkerLayerInner<M extends MapEntryMarker>(
  {
    markers,
    selectedMarkerId,
    onSelectMarker,
    renderMarker,
    selectedFactory,
    inOverview,
    hoveredFactory,
    memberFactories,
    accentByName,
    viewport,
  }: MapMarkerLayerProps<M>,
  ref: React.ForwardedRef<MapMarkerLayerHandle>
) {
  const viewRef = useRef<YardView | null>(null)
  const markerNodes = useRef(new Map<string, HTMLElement>())
  const labelNodes = useRef(new Map<string, HTMLElement>())

  const place = useCallback(() => {
    const view = viewRef.current
    if (!view || viewport.width === 0) return
    /*
     * 3D(기울인) 카메라에서 마커를 얹는 높이 — 드릴인하면 지붕 높이(마커를 고르는 화면).
     * **전체 보기에서는 지면(0)에 깐다**: 마커가 공장 발자국 밑단으로 가라앉아 배경이 되고,
     * 지붕 위 공장 이름이 주인공으로 남는다.
     */
    const markerAltitude = view.pitch > 0 && !inOverview ? MARKER_METERS : 0
    for (const item of markers) {
      const node = markerNodes.current.get(item.id)
      if (!node) continue
      const { sx, sy } = worldToScreen(view, viewport, item.lat, item.lon, markerAltitude)
      const off = sx < -20 || sy < -20 || sx > viewport.width + 20 || sy > viewport.height + 20
      node.style.visibility = off ? 'hidden' : 'visible'
      if (!off) node.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`
    }
    /* 공장 이름 라벨은 캔버스 라벨과 같은 앵커·높이(지붕 위)를 쓴다 */
    const labelAltitude = view.pitch > 0 ? NAME_METERS : 0
    for (const factory of memberFactories) {
      const node = labelNodes.current.get(factory.name)
      if (!node) continue
      const { sx, sy } = worldToScreen(
        view,
        viewport,
        factory.labelAnchor.lat,
        factory.labelAnchor.lon,
        labelAltitude
      )
      const off = sx < -80 || sy < -20 || sx > viewport.width + 80 || sy > viewport.height + 20
      node.style.visibility = off ? 'hidden' : 'visible'
      if (!off) node.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`
    }
  }, [markers, memberFactories, viewport, inOverview])

  useImperativeHandle(
    ref,
    () => ({
      update: (next: YardView) => {
        viewRef.current = next
        place()
      },
    }),
    [place]
  )

  /* 자료·뷰포트가 바뀌어 다시 그린 뒤에는 새 노드가 제자리를 모른다 — 그릴 때마다 한 번 */
  useLayoutEffect(place)

  return (
    <>
      {/* 마커 — 캔버스 위 DOM 층. 지도 조작은 아래 캔버스가 받도록 층 자체는 클릭 투과.
          마커는 **공장을 골라 드릴인한 뒤에만** 누를 수 있다 — 전체 보기·타 공장 마커는
          클릭 투과라, 그 자리를 누르면 지도가 받아 그 공장 선택(또는 전체 보기 복귀)이 된다 */}
      <div className="pointer-events-none absolute inset-0">
        {markers.map((item) => {
          const selected = item.id === selectedMarkerId
          const selectable = !inOverview && item.factory === selectedFactory
          const dim = !inOverview && !selectable
          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) markerNodes.current.set(item.id, node)
                else markerNodes.current.delete(item.id)
              }}
              type="button"
              onClick={() => onSelectMarker(item.id)}
              tabIndex={selectable ? 0 : -1}
              title={item.title}
              aria-label={item.ariaLabel ?? item.id}
              className={cn(
                'absolute left-0 top-0 flex h-7 w-7 items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                selectable ? 'pointer-events-auto' : 'pointer-events-none',
                /* 전체 보기 — 마커는 지면에 깔린 배경: 작고 흐리게 물러난다 */
                inOverview ? 'opacity-60' : dim && 'opacity-45',
                selected && 'z-10'
              )}
              /* 자리는 place() 가 transform 으로 넣는다 — 첫 프레임 전에는 숨겨 둔다 */
              style={{ visibility: 'hidden', willChange: 'transform' }}
            >
              {renderMarker(item, { selected, selectable, inOverview })}
            </button>
          )
        })}
      </div>

      {/* ── 공장 이름 라벨 — 마커 **위** 층: 이름이 항상 제일 위에 남는다. 클릭은 투과해
           그 자리의 공장 폴리곤(캔버스)이 받는다. **드릴인한 공장은 라벨을 지운다** —
           그 이름은 이미 우측 카드·상세 헤더가 크게 말하고 있고, 지붕 위 라벨은 마커만
           가린다. 호버 글로우는 **그 공장의 강조색**(accentOf)이다 ── */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {memberFactories.map(({ name }) => {
          if (!inOverview && name === selectedFactory) return null
          const hovered = name === hoveredFactory
          const accent = accentByName.get(name) ?? '#c9c4bc'
          return (
            <span
              key={name}
              ref={(node) => {
                if (node) labelNodes.current.set(name, node)
                else labelNodes.current.delete(name)
              }}
              className={cn(
                'absolute left-0 top-0 whitespace-nowrap rounded-inshop-md border px-2 py-0.5 text-[11px] font-bold tracking-[-0.01em] backdrop-blur-[2px] transition-opacity',
                hovered || inOverview ? 'opacity-100' : 'opacity-60'
              )}
              style={{
                visibility: 'hidden',
                willChange: 'transform',
                color: '#fff',
                background: 'rgba(7,11,16,0.78)',
                borderColor: hovered ? accent : 'rgba(255,255,255,0.18)',
                boxShadow: hovered
                  ? `0 0 10px ${accent}80, 0 2px 6px rgba(0,0,0,0.5)`
                  : '0 2px 6px rgba(0,0,0,0.5)',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              {name}
            </span>
          )
        })}
      </div>
    </>
  )
}

/* 제네릭을 살린 forwardRef — 마커 타입 M 이 renderMarker 시그니처까지 흐르게 한다 */
export const MapMarkerLayer = forwardRef(MapMarkerLayerInner) as <M extends MapEntryMarker>(
  props: MapMarkerLayerProps<M> & { ref?: React.ForwardedRef<MapMarkerLayerHandle> }
) => ReturnType<typeof MapMarkerLayerInner>
