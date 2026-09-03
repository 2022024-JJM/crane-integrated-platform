import { forwardRef, useImperativeHandle, useState, type ReactNode } from 'react'
import {
  RELIEF_METERS,
  worldToScreen,
  type LatLon,
  type Viewport,
  type YardView,
} from '../../yard-map'

/**
 * 고른 공장의 **떠 있는 이름패**.
 *
 * 고르기 전, 공장 이름은 캔버스가 지붕 평면에 눕혀 그린다(YardMap 의 2.5D 이름줄) —
 * 건물에 페인트로 쓴 글씨다. 공장을 고르면 그 글씨는 지붕에서 사라지고 이 패가 같은
 * 자리에서 일어서며 떠오른다: 누운 자세에서 정면으로, 지붕 높이에서 그 위로. 그래서
 * "누워 있던 이름이 떠올랐다"가 한 동작으로 읽힌다(자세·높이가 따로 놀면 그냥 팝업이다).
 *
 * 자리는 공장 **실루엣의 꼭대기 위**다. 중심 위에 고정 높이로 띄우면 배율에 따라 패가
 * 지붕 한복판에 얹혀 베이 이름을 가린다 — 가릴 수 없는 자리는 건물 바깥밖에 없고, 그
 * 바깥에서 건물과 가장 가까운 데가 실루엣 바로 위다. 그래서 소속 지번의 화면 좌표 중
 * 가장 높은 점을 찾아 그보다 조금 위에 패의 밑단을 놓는다.
 *
 * 캔버스가 아니라 DOM 인 이유는 야드의 다른 라벨(YardFacilityLabels)과 같다 — 글자가
 * 또렷해야 하고, 무엇보다 **유리 질감과 부유(bob)를 CSS 에 맡길 수 있다**. 캔버스로 하면
 * 떠 있는 동안 매 프레임 지도 전체를 다시 그려야 한다.
 *
 * 카메라는 props 가 아니라 imperative handle 로 받는다 — 비행·드래그의 매 프레임마다
 * 부모(대시보드)가 리렌더되면 우측 공정존 패널까지 함께 다시 그려진다. 프레임마다
 * 다시 그리는 것은 이 층뿐이어야 한다(PaintingCameraLayer 와 같은 결).
 */

/** 실루엣을 재는 높이(m) — 고른 공장 프리즘의 지붕(`parcel × 1.4`) 위 박공까지 */
const ROOF_METERS = RELIEF_METERS.parcel * 2.2

/** 실루엣 꼭대기와 패 밑단 사이 틈(px) — 붙지도 떠내려가지도 않을 만큼 */
const SILHOUETTE_GAP = 30

/** 화면 위쪽 한계(px) — 공장이 화면을 넘도록 확대해도 패는 남아 있어야 한다 */
const TOP_LIMIT = 96

/** 화면 밖이면 그리지 않는다 — 여백은 패 자체 폭만큼 */
const CULL_MARGIN = 200

export interface FactoryHudLabelHandle {
  updateView: (view: YardView, viewport: Viewport) => void
}

export interface FactoryHudCamera {
  view: YardView
  viewport: Viewport
}

interface FactoryHudLabelProps {
  /** 공장 이름 — 패에 크게 적힌다 */
  name: string
  /** 가로 자리의 기준 — 공장 지번들의 centroid (`YardParcelFactory.labelAnchor`) */
  anchor: LatLon
  /** 실루엣을 재는 점들 — 이 공장 소속 지번 폴리곤의 꼭짓점 전부 */
  outline: readonly LatLon[]
  /** 공정색 — 글자는 흰색이고 색은 **빛과 테두리로만** 얹는다 (야드 라벨과 같은 규칙) */
  color: string
  /** 패 아래 작게 붙는 한 줄 (공정명·베이 수 등). 없으면 줄을 만들지 않는다 */
  caption?: string
  /**
   * 처음 그릴 때 쓸 카메라. 이 패는 공장을 고르는 순간 붙는데, 그때 카메라 알림은 아직
   * 오지 않았다 — 부모가 마지막으로 받아 둔 값을 넘겨 첫 프레임부터 제자리에 서게 한다.
   */
  initialCamera: FactoryHudCamera | null
  /**
   * 패 바로 밑에 붙는 행동(R11 — '공정 화면으로' 나가는 문). 층 전체는 지도 조작을
   * 통과시키므로(pointer-events-none), 이 슬롯만 클릭을 받는다. 없으면 층은 순수
   * 장식이라 스크린리더에서도 걷는다(aria-hidden).
   */
  action?: ReactNode
}

export const FactoryHudLabel = forwardRef<FactoryHudLabelHandle, FactoryHudLabelProps>(
  function FactoryHudLabel({ name, anchor, outline, color, caption, initialCamera, action }, ref) {
    const [camera, setCamera] = useState<FactoryHudCamera | null>(initialCamera)
    useImperativeHandle(
      ref,
      () => ({ updateView: (view, viewport) => setCamera({ view, viewport }) }),
      []
    )

    if (!camera || camera.viewport.width === 0) return null
    const { view, viewport } = camera

    const center = worldToScreen(view, viewport, anchor.lat, anchor.lon, ROOF_METERS)
    let top = center.sy
    for (const p of outline) {
      const sy = worldToScreen(view, viewport, p.lat, p.lon, ROOF_METERS).sy
      if (sy < top) top = sy
    }
    /* 패의 **밑단**이 놓일 자리 — 실루엣 위, 다만 화면 밖으로는 밀려나지 않게 */
    const baseY = Math.max(TOP_LIMIT, top - SILHOUETTE_GAP)
    if (
      center.sx < -CULL_MARGIN ||
      center.sx > viewport.width + CULL_MARGIN ||
      baseY > viewport.height + CULL_MARGIN
    ) {
      return null
    }

    return (
      <div
        aria-hidden={action ? undefined : 'true'}
        data-hud-anchor={`${Math.round(center.sx)},${Math.round(baseY)}`}
        className="pointer-events-none absolute inset-0 overflow-hidden"
        /* 눕힌 자세(rotateX)가 원근으로 보이려면 조상에 perspective 가 있어야 한다 */
        style={{ perspective: '900px' }}
      >
        {/* 자리잡기 · 밑단 맞춤 · 떠오름 · 부유를 서로 다른 층에 나눠 건다 —
            한 엘리먼트에 겹치면 뒤엣것의 transform 이 앞엣것을 통째로 덮어쓴다 */}
        <div className="absolute" style={{ left: center.sx, top: baseY }}>
          <div className="-translate-x-1/2 -translate-y-full">
            <div className="factory-hud-rise" style={{ willChange: 'transform, opacity' }}>
              <div className="factory-hud-bob relative">
                {/* 뒤에 깔린 색 번짐 — 유리를 투명하게 둔 대신 눈이 먼저 닿을 자리를 만든다 */}
                <span
                  className="absolute -inset-6 rounded-full blur-2xl"
                  style={{ backgroundColor: color, opacity: 0.22 }}
                />

                <div
                  className="relative whitespace-nowrap rounded-inshop-xl border px-6 py-2.5 backdrop-blur-xl"
                  style={{
                    borderColor: 'rgba(255,255,255,0.3)',
                    /* 유리 — 배경이 비쳐야 "떠 있는 판"이지 "덮은 패"가 아니다 */
                    backgroundColor: 'rgba(12, 18, 26, 0.3)',
                    backgroundImage:
                      'linear-gradient(155deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 46%, rgba(255,255,255,0) 70%)',
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.34), inset 0 0 22px ${color}2e, 0 0 26px ${color}66, 0 16px 38px rgba(0,0,0,0.45)`,
                  }}
                >
                  {/* 네 모서리 꺾쇠 — 계측 화면의 표식. 이름패가 아니라 조준으로 읽힌다 */}
                  {(
                    [
                      ['-top-px -left-px', 'border-t-2 border-l-2 rounded-tl-inshop-xl'],
                      ['-top-px -right-px', 'border-t-2 border-r-2 rounded-tr-inshop-xl'],
                      ['-bottom-px -left-px', 'border-b-2 border-l-2 rounded-bl-inshop-xl'],
                      ['-bottom-px -right-px', 'border-b-2 border-r-2 rounded-br-inshop-xl'],
                    ] as const
                  ).map(([place, edges]) => (
                    <span
                      key={place}
                      className={`absolute h-3 w-3 ${place} ${edges}`}
                      style={{ borderColor: '#ffffff', opacity: 0.85 }}
                    />
                  ))}

                  <span
                    className="block text-center text-inshop-2xl font-bold leading-tight tracking-[0.2em] text-white"
                    style={{
                      textShadow: `0 0 12px ${color}, 0 0 30px ${color}, 0 2px 4px rgba(0,0,0,0.75)`,
                    }}
                  >
                    {name}
                  </span>
                  {caption && (
                    <span
                      className="mt-1 flex items-center justify-center gap-1.5 text-2xs tracking-[0.12em] text-white/72"
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                    >
                      <span
                        aria-hidden="true"
                        className="h-1 w-1 rounded-full"
                        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                      />
                      {caption}
                    </span>
                  )}
                </div>

                {/* 나가는 문 — 패와 함께 떠다니되, 클릭은 이 조각만 받는다(R11).
                    크기는 화면 고정(줌 비례 없음) — 패와 같은 규칙이다 */}
                {action && <div className="pointer-events-auto mt-2">{action}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
)
