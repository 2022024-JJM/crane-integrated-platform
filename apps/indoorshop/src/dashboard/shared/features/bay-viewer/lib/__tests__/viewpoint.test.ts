import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { PLAN_VIEWPOINT, orbitDirection, planAlignedAzimuth } from '../viewpoint'

/*
 * 기본 시점 — **도면에서 이어지는 각**.
 *
 * 현황 탭의 설비 배치는 위에서 곧게 내려다본 그림이다. 3D 뷰어가 낮은 각에서 시작하면
 * 같은 정반을 보고 있다는 느낌이 끊긴다. 세 장면(공장 전체·정반·실측)이 이 각 하나를
 * 공유하는 것이 요점이라, 각이 흔들리면 그 이유가 사라진다.
 */
describe('3D 기본 시점 — 도면에서 이어진다', () => {
  it('위에서 내려다보되 도면이 되지는 않는다 (35°~60°)', () => {
    expect(PLAN_VIEWPOINT.elevationDeg).toBeGreaterThanOrEqual(35)
    expect(PLAN_VIEWPOINT.elevationDeg).toBeLessThanOrEqual(60)
  })

  /* 0° 면 납작해 깊이가 안 읽히고, 많이 틀면 도면에서 외운 좌우 순서가 뒤집힌다 */
  it('오른쪽으로 **약간** 튼 대각이다 (10°~35°)', () => {
    expect(PLAN_VIEWPOINT.azimuthDeg).toBeGreaterThanOrEqual(10)
    expect(PLAN_VIEWPOINT.azimuthDeg).toBeLessThanOrEqual(35)
  })

  it('방향은 단위벡터다 — 거리는 장면이 따로 정한다', () => {
    expect(orbitDirection().length()).toBeCloseTo(1, 6)
  })

  it('카메라는 타겟의 위·오른쪽·앞에 선다', () => {
    const d = orbitDirection()
    expect(d.y).toBeGreaterThan(0)
    expect(d.x).toBeGreaterThan(0)
    expect(d.z).toBeGreaterThan(0)
  })

  it('고도가 방향의 y 를 정한다 — 각과 벡터가 어긋나지 않는다', () => {
    const d = orbitDirection(48, 22)
    expect(THREE.MathUtils.radToDeg(Math.asin(d.y))).toBeCloseTo(48, 6)
    expect(THREE.MathUtils.radToDeg(Math.atan2(d.x, d.z))).toBeCloseTo(22, 6)
  })

  it('방위 0° 면 정면 — 좌우로 틀지 않는다', () => {
    expect(orbitDirection(48, 0).x).toBeCloseTo(0, 6)
  })
})

/*
 * 도면과 3D 가 **같은 자세로** 선다.
 *
 * 현황 탭의 배치도는 베이 장변을 가로로 눕혀 그린다(R42). 3D 가 모델 좌표 그대로 서면
 * 같은 공장이 두 그림에서 다른 각으로 누워, 탭을 옮길 때마다 새 그림이 된다.
 */
describe('도면 정렬 방위', () => {
  /** 방위 a 인 궤도 카메라에서 세계 방향 d 가 화면에서 이루는 각(도) */
  function screenAngleOf(axis: readonly [number, number], azimuth: number): number {
    const e = THREE.MathUtils.degToRad(PLAN_VIEWPOINT.elevationDeg)
    const [dx, dz] = axis
    const sx = dx * Math.cos(azimuth) - dz * Math.sin(azimuth)
    const sy = (dx * Math.sin(azimuth) + dz * Math.cos(azimuth)) * Math.sin(e)
    return Math.abs(THREE.MathUtils.radToDeg(Math.atan2(sy, sx)))
  }

  it('기울임을 0 으로 두면 장변이 화면 가로에 눕는다', () => {
    for (const axis of [[1, 0], [0, 1], [0.6, 0.8], [-0.5, 0.87]] as const) {
      expect(screenAngleOf(axis, planAlignedAzimuth(axis, 0))).toBeCloseTo(0, 6)
    }
  })

  /* 도면 그대로면 3D 로 온 뜻이 없고, 많이 틀면 도면에서 외운 좌우가 뒤집힌다 */
  it('기본 기울임에서는 **약간** 기운다 (5°~30°)', () => {
    for (const axis of [[1, 0], [0, 1], [0.6, 0.8]] as const) {
      const angle = screenAngleOf(axis, planAlignedAzimuth(axis))
      expect(angle).toBeGreaterThan(5)
      expect(angle).toBeLessThan(30)
    }
  })

  it('축이 없으면 돌리지 않는다 — 근거 없이 기울이지 않는다', () => {
    expect(planAlignedAzimuth([0, 0], 0)).toBe(0)
  })
})
