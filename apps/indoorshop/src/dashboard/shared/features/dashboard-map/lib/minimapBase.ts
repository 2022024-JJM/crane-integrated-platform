import { colorOfProcess, type YardParcelLot } from '../../../entities/yard-parcels'
import type { LatLonBounds } from '../../yard-map'

/*
 * 미니맵의 **바탕 그림 캐시**.
 *
 * 미니맵은 카메라가 움직일 때마다(초당 20번) 캔버스를 지우고 **지번 폴리곤 수백 장을
 * 처음부터 다시 그린다.** 그런데 그 폴리곤은 카메라와 아무 상관이 없다 — 매 프레임 바뀌는
 * 것은 지금 보고 있는 범위를 나타내는 **사각형 하나**뿐이다.
 *
 * 그래서 바탕(배경 + 지번)을 화면 밖 캔버스에 한 번만 그려 두고, 매 프레임에는 그것을
 * 통째로 복사한 뒤 사각형만 얹는다. 바탕을 다시 그리는 때는 **내용이 바뀔 때뿐**이다 —
 * 지번 자료가 갈리거나, 캔버스 크기·픽셀 밀도가 바뀌거나, 범위가 달라질 때.
 *
 * 결과 픽셀은 같다. 달라지는 것은 "몇 번 그리느냐"뿐이다.
 */

/** 그리기에 필요한 최소한의 2D 컨텍스트 — 테스트가 가짜를 넣을 수 있게 좁혀 둔다 */
export interface Minimal2DContext {
  setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void
  clearRect: (x: number, y: number, w: number, h: number) => void
  fillRect: (x: number, y: number, w: number, h: number) => void
  beginPath: () => void
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  closePath: () => void
  fill: () => void
  fillStyle: string
  globalAlpha: number
}

export interface MinimapBaseInput {
  extent: LatLonBounds
  lots: readonly YardParcelLot[]
  /** CSS 픽셀 크기 */
  width: number
  height: number
  dpr: number
  pad: number
}

/** 지번 → 캔버스 좌표 변환 — 바탕과 사각형이 같은 잣대를 쓰도록 한 곳에서 만든다 */
export function minimapProjection(input: Pick<MinimapBaseInput, 'extent' | 'width' | 'height' | 'pad'>) {
  const { extent, width, height, pad } = input
  const spanLon = Math.max(0.000001, extent.maxLon - extent.minLon)
  const spanLat = Math.max(0.000001, extent.maxLat - extent.minLat)
  return {
    x: (lon: number) => pad + ((lon - extent.minLon) / spanLon) * (width - pad * 2),
    y: (lat: number) => pad + ((extent.maxLat - lat) / spanLat) * (height - pad * 2),
  }
}

/** 바탕을 한 장 그린다 — 배경 + 지번 폴리곤 (카메라와 무관한 전부) */
export function drawMinimapBase(ctx: Minimal2DContext, input: MinimapBaseInput): void {
  const { width, height, dpr, lots } = input
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#071018'
  ctx.fillRect(0, 0, width, height)

  const project = minimapProjection(input)
  for (const lot of lots) {
    if (lot.polygon.length < 3 || !lot.factory) continue
    ctx.beginPath()
    lot.polygon.forEach((point, index) => {
      const px = project.x(point.lon)
      const py = project.y(point.lat)
      if (index === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.fillStyle = lot.process ? colorOfProcess(lot.process) : '#53616c'
    ctx.globalAlpha = 0.7
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/**
 * 바탕이 달라졌는지 가리는 열쇠.
 *
 * 지번 목록은 문자열로 풀지 않는다(수백 장을 매 프레임 직렬화하는 것이 더 비싸다) —
 * **같은 배열인가**로 본다. 자료가 갈리면 새 배열이 오므로 그것으로 충분하다.
 */
export function minimapBaseKey(input: MinimapBaseInput): string {
  const { extent, width, height, dpr, pad, lots } = input
  return [
    extent.minLat,
    extent.minLon,
    extent.maxLat,
    extent.maxLon,
    width,
    height,
    dpr,
    pad,
    lots.length,
  ].join('|')
}

/** 캐시가 들고 있는 한 장 */
export interface MinimapBaseSurface<C> {
  canvas: C
  ctx: Minimal2DContext
}

export interface MinimapBaseCache<C> {
  /** 지금 입력에 맞는 바탕을 준다 — 필요할 때만 다시 그린다 */
  surfaceFor: (input: MinimapBaseInput) => C | null
  /** 실제로 바탕을 다시 그린 횟수 — 캐시가 듣는지 확인하는 창구(테스트·진단) */
  rebuildCount: () => number
}

/**
 * 바탕 캐시를 만든다.
 *
 * 캔버스 만드는 일을 주입받는다 — 브라우저에서는 `document.createElement('canvas')` 지만,
 * 2D 컨텍스트가 없는 환경(jsdom)에서는 `null` 을 주게 해서 **캐시 없이도 돌아가게** 한다.
 * 성능 장치가 없는 환경에서 화면이 깨지는 것이 제일 나쁜 결과다.
 */
export function createMinimapBaseCache<C>(
  createSurface: (width: number, height: number) => MinimapBaseSurface<C> | null
): MinimapBaseCache<C> {
  let surface: MinimapBaseSurface<C> | null = null
  let key: string | null = null
  let lots: readonly YardParcelLot[] | null = null
  let rebuilds = 0

  return {
    surfaceFor(input) {
      const nextKey = minimapBaseKey(input)
      /* 열쇠가 같고 **같은 지번 배열**이면 그려 둔 것을 그대로 쓴다 */
      if (surface && key === nextKey && lots === input.lots) return surface.canvas

      const next = createSurface(
        Math.round(input.width * input.dpr),
        Math.round(input.height * input.dpr)
      )
      if (!next) return null
      drawMinimapBase(next.ctx, input)
      surface = next
      key = nextKey
      lots = input.lots
      rebuilds += 1
      return next.canvas
    },
    rebuildCount: () => rebuilds,
  }
}
