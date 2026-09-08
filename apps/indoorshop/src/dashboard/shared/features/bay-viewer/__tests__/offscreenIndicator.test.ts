import { describe, expect, it } from 'vitest'
import { edgePlacementFor } from '../lib/offscreenIndicator'

const W = 1000
const H = 500
const M = 24

describe('edgePlacementFor — 화면 밖 이상 정반 방향 표식 (FR-9)', () => {
  it('뷰포트 안에 보이면 표식이 없다', () => {
    expect(edgePlacementFor(0, 0, false, W, H, M)).toBeNull()
    expect(edgePlacementFor(0.9, -0.8, false, W, H, M)).toBeNull()
  })

  it('오른쪽 밖 — 오른쪽 여백 경계에, 화살표는 오른쪽(0°)을 가리킨다', () => {
    const placed = edgePlacementFor(2, 0, false, W, H, M)
    expect(placed).not.toBeNull()
    expect(placed!.x).toBeCloseTo(W - M)
    expect(placed!.y).toBeCloseTo(H / 2)
    expect(placed!.angleDeg).toBeCloseTo(0)
  })

  it('위쪽 밖 — 위 여백 경계에, 화살표는 위(-90°)를 가리킨다', () => {
    const placed = edgePlacementFor(0, 2, false, W, H, M)
    expect(placed).not.toBeNull()
    expect(placed!.x).toBeCloseTo(W / 2)
    expect(placed!.y).toBeCloseTo(M)
    expect(placed!.angleDeg).toBeCloseTo(-90)
  })

  it('모서리 방향 — 두 축 모두 여백 사각형 안에 남는다', () => {
    const placed = edgePlacementFor(-3, 3, false, W, H, M)
    expect(placed).not.toBeNull()
    expect(placed!.x).toBeGreaterThanOrEqual(M)
    expect(placed!.y).toBeGreaterThanOrEqual(M)
    expect(placed!.x).toBeLessThanOrEqual(W - M)
    expect(placed!.y).toBeLessThanOrEqual(H - M)
  })

  it('카메라 뒤 대상은 투영이 반대편에 찍힌다 — 방향을 되집는다', () => {
    const front = edgePlacementFor(2, 0, false, W, H, M)
    const behind = edgePlacementFor(2, 0, true, W, H, M)
    expect(behind).not.toBeNull()
    expect(behind!.x).toBeCloseTo(M)
    expect(Math.abs(behind!.angleDeg)).toBeCloseTo(180)
    expect(front!.x).not.toBeCloseTo(behind!.x)
  })

  it('카메라 뒤 + 화면 중심 투영도 표식을 낸다 (보이는 것으로 오판하지 않는다)', () => {
    expect(edgePlacementFor(0, 0, true, W, H, M)).not.toBeNull()
  })

  it('뷰포트 크기가 없으면 null — 계산하지 않는다', () => {
    expect(edgePlacementFor(2, 0, false, 0, 0, M)).toBeNull()
  })
})
