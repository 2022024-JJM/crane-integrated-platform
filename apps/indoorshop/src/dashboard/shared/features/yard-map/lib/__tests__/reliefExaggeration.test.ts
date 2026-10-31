import { describe, expect, it } from 'vitest'
import { RELIEF_EXAGGERATION, project, type YardView } from '../projection'

/*
 * 높이 과장 — 기울인 카메라(공정·공장 목록)에서는 건물로 서고, 확대와 상관없이 같은 비율을
 * 지킨다. 공장을 고르면 카메라가 바로 위로 서서 평면이 된다(사용자 확정).
 */
const viewport = { width: 1440, height: 900 }
const viewAt = (scale: number, pitch = 50): YardView => ({ centerLat: 34.89, centerLon: 128.69, scale, bearing: -48, pitch })

/** 지면과 높이 12m(공장 지번)의 화면 거리(px) */
function wallPx(scale: number, pitch = 50): number {
  const view = viewAt(scale, pitch)
  const ground = project(view, viewport, view.centerLat, view.centerLon, 0)
  const roof = project(view, viewport, view.centerLat, view.centerLon, 12)
  return Math.abs(ground.sy - roof.sy)
}

describe('높이 과장', () => {
  it('야드 전경 배율(약 54,000)에서 12m 공장의 벽이 뚜렷이 선다', () => {
    expect(RELIEF_EXAGGERATION).toBeGreaterThan(1)
    expect(wallPx(54_000)).toBeGreaterThan(15)
  })

  it('확대와 상관없이 높이의 비율이 같다 — 배율을 두 배로 하면 벽도 두 배', () => {
    expect(wallPx(108_000) / wallPx(54_000)).toBeCloseTo(2, 1)
  })

  it('바로 위(공장을 고른 뒤의 버드뷰)에서는 높이가 화면에 닿지 않는다 — 평면', () => {
    expect(wallPx(54_000, 0)).toBe(0)
    expect(wallPx(400_000, 0)).toBe(0)
  })
})
