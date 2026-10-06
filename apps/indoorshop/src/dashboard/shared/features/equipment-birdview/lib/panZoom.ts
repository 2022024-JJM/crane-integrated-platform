/**
 * 배치 그림 확대·이동 — 뷰박스 단위의 순수 계산.
 *
 * 그림 내용은 `translate(x y) scale(k)` 로 그린다. `k = 1, x = y = 0` 이 그릇에 맞춘
 * 기본 모습이고, 그보다 작게는 줄이지 않는다(그림 밖 빈 바닥만 늘어난다). 이동은 그림이
 * 그릇 밖으로 빠져나가지 않는 범위로 가둔다 — 끌다 보면 그림을 잃는 일이 없게.
 */
export interface PanZoom {
  k: number
  x: number
  y: number
}

export const PAN_ZOOM_IDENTITY: PanZoom = { k: 1, x: 0, y: 0 }
/** 최대 배율 — 심볼 한 판이 손가락만 해지면 더 키워도 읽히는 것이 없다 */
export const PAN_ZOOM_MAX = 8

interface Size {
  width: number
  height: number
}

/** 그림이 그릇을 벗어나지 않게 이동량을 가둔다 */
export function clampPanZoom(state: PanZoom, view: Size): PanZoom {
  const k = Math.min(PAN_ZOOM_MAX, Math.max(1, Number.isFinite(state.k) ? state.k : 1))
  const clamp = (value: number, size: number) =>
    Math.min(0, Math.max(size * (1 - k), Number.isFinite(value) ? value : 0))
  return { k, x: clamp(state.x, view.width), y: clamp(state.y, view.height) }
}

/**
 * `point`(뷰박스 단위) 를 제자리에 둔 채 `factor` 배 확대한다 — 커서·손가락 아래의
 * 자리가 그대로 남아야 "거기를 키운다" 가 된다.
 */
export function zoomAt(
  state: PanZoom,
  point: { x: number; y: number },
  factor: number,
  view: Size
): PanZoom {
  if (!Number.isFinite(factor) || factor <= 0) return state
  const k = Math.min(PAN_ZOOM_MAX, Math.max(1, state.k * factor))
  const ratio = k / state.k
  return clampPanZoom(
    {
      k,
      x: point.x - (point.x - state.x) * ratio,
      y: point.y - (point.y - state.y) * ratio,
    },
    view
  )
}

/** 뷰박스 단위로 `dx, dy` 만큼 끌어 옮긴다 */
export function panBy(state: PanZoom, dx: number, dy: number, view: Size): PanZoom {
  return clampPanZoom({ k: state.k, x: state.x + dx, y: state.y + dy }, view)
}

/** 휠 한 칸의 배율 — deltaY 에 비례하되 한 번에 크게 튀지 않게 */
export function wheelZoomFactor(deltaY: number): number {
  if (!Number.isFinite(deltaY)) return 1
  const step = Math.max(-200, Math.min(200, deltaY))
  return Math.exp(-step * 0.0025)
}

/** 확대된 그림 위의 점(뷰박스 단위)을 화면에서의 뷰박스 단위로 옮긴다 */
export function applyPanZoom(state: PanZoom, point: { x: number; y: number }) {
  return { x: point.x * state.k + state.x, y: point.y * state.k + state.y }
}
