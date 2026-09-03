import { describe, expect, it } from 'vitest'
import { convexHullOf } from '../lib/hull'

/* 공장 외곽 — 그린 것이 전부 이 선 안에 있어야 그림이 거짓말을 하지 않는다 */
describe('convexHullOf', () => {
  const box = [
    { lat: 34.87, lon: 128.69 },
    { lat: 34.88, lon: 128.69 },
    { lat: 34.88, lon: 128.7 },
    { lat: 34.87, lon: 128.7 },
    /* 안쪽 점 — 껍질에 들어가면 안 된다 */
    { lat: 34.875, lon: 128.695 },
  ]

  it('안쪽 점은 껍질에 들지 않는다', () => {
    const hull = convexHullOf(box)
    expect(hull).toHaveLength(4)
    expect(hull.some((p) => p.lat === 34.875 && p.lon === 128.695)).toBe(false)
  })

  it('모든 점을 감싼다', () => {
    const hull = convexHullOf(box)
    const lats = hull.map((p) => p.lat)
    const lons = hull.map((p) => p.lon)
    for (const point of box) {
      expect(point.lat).toBeGreaterThanOrEqual(Math.min(...lats))
      expect(point.lat).toBeLessThanOrEqual(Math.max(...lats))
      expect(point.lon).toBeGreaterThanOrEqual(Math.min(...lons))
      expect(point.lon).toBeLessThanOrEqual(Math.max(...lons))
    }
  })

  it('점이 3개 미만이면 그리지 않는다 — 선 하나를 외곽이라 부르지 않는다', () => {
    expect(convexHullOf([])).toEqual([])
    expect(convexHullOf([{ lat: 34.87, lon: 128.69 }])).toEqual([])
    expect(
      convexHullOf([
        { lat: 34.87, lon: 128.69 },
        { lat: 34.88, lon: 128.7 },
      ])
    ).toEqual([])
  })

  it('한 줄로 늘어선 점들은 도형이 되지 못한다', () => {
    expect(
      convexHullOf([
        { lat: 34.87, lon: 128.69 },
        { lat: 34.875, lon: 128.69 },
        { lat: 34.88, lon: 128.69 },
      ])
    ).toEqual([])
  })

  it('결정적이다 — 입력 순서가 달라도 같은 껍질', () => {
    const a = convexHullOf(box)
    const b = convexHullOf([...box].reverse())
    expect(new Set(a.map((p) => `${p.lat},${p.lon}`))).toEqual(
      new Set(b.map((p) => `${p.lat},${p.lon}`))
    )
  })
})
