import { describe, expect, it } from 'vitest'
import {
  PAN_ZOOM_IDENTITY,
  PAN_ZOOM_MAX,
  applyPanZoom,
  clampPanZoom,
  panBy,
  wheelZoomFactor,
  zoomAt,
} from '../lib/panZoom'

const VIEW = { width: 400, height: 300 }

describe('zoomAt', () => {
  it('커서 아래 자리는 확대 전후로 같은 화면 자리에 남는다', () => {
    const point = { x: 120, y: 80 }
    const next = zoomAt(PAN_ZOOM_IDENTITY, point, 2, VIEW)
    expect(next.k).toBe(2)
    expect(applyPanZoom(next, point)).toEqual(point)
  })

  it('1 아래로는 줄이지 않는다 — 처음 모습이 하한이다', () => {
    expect(zoomAt(PAN_ZOOM_IDENTITY, { x: 10, y: 10 }, 0.5, VIEW)).toEqual(PAN_ZOOM_IDENTITY)
  })

  it('최대 배율 정확값은 통과, 넘으면 최대에 묶인다', () => {
    expect(zoomAt(PAN_ZOOM_IDENTITY, { x: 0, y: 0 }, PAN_ZOOM_MAX, VIEW).k).toBe(PAN_ZOOM_MAX)
    expect(zoomAt(PAN_ZOOM_IDENTITY, { x: 0, y: 0 }, PAN_ZOOM_MAX * 2, VIEW).k).toBe(PAN_ZOOM_MAX)
  })

  it('잘못된 배율(0·음수·NaN·Infinity)은 상태를 그대로 돌려준다', () => {
    const state = { k: 2, x: -50, y: -40 }
    for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(zoomAt(state, { x: 0, y: 0 }, factor, VIEW)).toBe(state)
    }
  })
})

describe('panBy / clampPanZoom', () => {
  it('처음 모습(k=1)에서는 옮길 자리가 없다', () => {
    expect(panBy(PAN_ZOOM_IDENTITY, 30, -20, VIEW)).toEqual(PAN_ZOOM_IDENTITY)
  })

  it('확대 상태에서는 그림이 그릇을 벗어나지 않는 만큼만 옮겨진다', () => {
    const state = { k: 2, x: -100, y: -100 }
    expect(panBy(state, 30, 20, VIEW)).toEqual({ k: 2, x: -70, y: -80 })
    /* 경계 정확값: x 는 [-400, 0], y 는 [-300, 0] */
    expect(panBy(state, 100, 100, VIEW)).toEqual({ k: 2, x: 0, y: 0 })
    expect(panBy(state, -1000, -1000, VIEW)).toEqual({ k: 2, x: -400, y: -300 })
  })

  it('오염된 값(NaN)은 처음 모습 쪽으로 되돌린다', () => {
    expect(clampPanZoom({ k: Number.NaN, x: Number.NaN, y: 5 }, VIEW)).toEqual(PAN_ZOOM_IDENTITY)
  })
})

describe('wheelZoomFactor', () => {
  it('위로 굴리면 확대, 아래로 굴리면 축소, 0 이면 그대로', () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1)
    expect(wheelZoomFactor(100)).toBeLessThan(1)
    expect(wheelZoomFactor(0)).toBe(1)
  })

  it('큰 deltaY 는 한 번에 튀지 않게 묶이고, NaN 은 1', () => {
    expect(wheelZoomFactor(-10_000)).toBe(wheelZoomFactor(-200))
    expect(wheelZoomFactor(Number.NaN)).toBe(1)
  })
})
