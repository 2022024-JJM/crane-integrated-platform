import { describe, expect, it } from 'vitest'
import { LON_SQUEEZE, boundsOfPoints, fitProjection, pathOf } from '../lib/projection'

/*
 * 버드뷰 투영 — 이 그림이 답하는 질문은 "그게 어느 자리냐" 하나다. 자리가 틀리면
 * 그림 전체가 거짓말이므로, 가로세로 비와 경도 압축을 계약으로 못 박는다.
 */
describe('birdview projection', () => {
  const square = [
    { lat: 34.87, lon: 128.69 },
    { lat: 34.88, lon: 128.70 },
  ]

  it('경도는 위도선 길이만큼 눌러 준다 — 안 누르면 공장이 옆으로 늘어난다', () => {
    /* 옥포(북위 약 34.87°)의 경도 1도는 위도 1도보다 짧다 */
    expect(LON_SQUEEZE).toBeGreaterThan(0.8)
    expect(LON_SQUEEZE).toBeLessThan(0.85)
  })

  it('가로세로 비를 지킨다 — 한 방향으로만 늘리면 베이가 다른 모양이 된다', () => {
    const bounds = boundsOfPoints(square)!
    const projection = fitProjection(bounds, { width: 1000, height: 420, padding: 0 })

    const a = projection.project({ lat: 34.87, lon: 128.69 })
    const b = projection.project({ lat: 34.88, lon: 128.69 })
    const c = projection.project({ lat: 34.87, lon: 128.70 })

    const dyPerLat = Math.abs(b.y - a.y) / 0.01
    const dxPerLon = Math.abs(c.x - a.x) / 0.01
    /* 같은 축척(경도는 이미 눌린 뒤라 위도와 같은 배율을 받는다) */
    expect(dxPerLon / LON_SQUEEZE).toBeCloseTo(dyPerLat, 3)
  })

  it('북쪽이 위다 — 위도가 큰 점이 y 가 작다', () => {
    const bounds = boundsOfPoints(square)!
    const projection = fitProjection(bounds, { width: 1000, height: 420, padding: 0 })
    const north = projection.project({ lat: 34.88, lon: 128.695 })
    const south = projection.project({ lat: 34.87, lon: 128.695 })
    expect(north.y).toBeLessThan(south.y)
  })

  it('좌표가 하나도 없으면 투영을 만들지 않는다 (빈 자리를 그리지 않는다)', () => {
    expect(boundsOfPoints([])).toBeNull()
  })

  it('폴리곤은 닫힌 경로가 된다', () => {
    const bounds = boundsOfPoints(square)!
    const projection = fitProjection(bounds, { width: 1000, height: 420, padding: 0 })
    const d = pathOf(
      [
        { lat: 34.87, lon: 128.69 },
        { lat: 34.88, lon: 128.69 },
        { lat: 34.88, lon: 128.70 },
      ],
      projection
    )
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
  })
})
