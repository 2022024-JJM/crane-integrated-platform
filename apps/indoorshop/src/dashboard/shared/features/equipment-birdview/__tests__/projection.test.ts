import { describe, expect, it } from 'vitest'
import { LON_SQUEEZE, fitProjection, pathOf } from '../lib/projection'

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
    const projection = fitProjection(square, { width: 1000, height: 420, padding: 0 })!

    const a = projection.project({ lat: 34.87, lon: 128.69 })
    const b = projection.project({ lat: 34.88, lon: 128.69 })
    const c = projection.project({ lat: 34.87, lon: 128.70 })

    const dyPerLat = Math.abs(b.y - a.y) / 0.01
    const dxPerLon = Math.abs(c.x - a.x) / 0.01
    /* 같은 축척(경도는 이미 눌린 뒤라 위도와 같은 배율을 받는다) */
    expect(dxPerLon / LON_SQUEEZE).toBeCloseTo(dyPerLat, 3)
  })

  it('북쪽이 위다 — 위도가 큰 점이 y 가 작다', () => {
    const projection = fitProjection(square, { width: 1000, height: 420, padding: 0 })!
    const north = projection.project({ lat: 34.88, lon: 128.695 })
    const south = projection.project({ lat: 34.87, lon: 128.695 })
    expect(north.y).toBeLessThan(south.y)
  })

  it('좌표가 하나도 없으면 투영을 만들지 않는다 (빈 자리를 그리지 않는다)', () => {
    expect(fitProjection([], { width: 1000, height: 420 })).toBeNull()
  })

  it('폴리곤은 닫힌 경로가 된다', () => {
    const projection = fitProjection(square, { width: 1000, height: 420, padding: 0 })!
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

  /*
   * R42 — 회전은 **강체 변환**이다. 돌리면 자세만 바뀌고 거리비는 그대로여야 한다.
   * 여기가 무너지면 회전이 배치를 왜곡하는 것이므로 도면이 아니라 다른 그림이 된다.
   */
  it('돌려도 두 점 사이 거리비가 그대로다 — 회전이 모양을 바꾸지 않는다', () => {
    const trio = [
      { lat: 34.87, lon: 128.69 },
      { lat: 34.88, lon: 128.7 },
      { lat: 34.875, lon: 128.705 },
    ]
    const box = { width: 1000, height: 1000, padding: 0 }
    const flat = fitProjection(trio, box)!
    const turned = fitProjection(trio, { ...box, rotation: 0.6 })!
    const spanOf = (projection: ReturnType<typeof fitProjection>) => {
      const [a, b, c] = trio.map((point) => projection!.project(point))
      return Math.hypot(a.x - b.x, a.y - b.y) / Math.hypot(b.x - c.x, b.y - c.y)
    }
    expect(spanOf(turned)).toBeCloseTo(spanOf(flat), 6)
  })

  it('회전각만큼 실제로 돌아간다 — 가로로 누운 선이 세로로 선다', () => {
    /* 경도 방향으로만 늘어선 두 점 = 화면에서 가로선. 90° 돌리면 세로선이 된다 */
    const line = [
      { lat: 34.87, lon: 128.69 },
      { lat: 34.87, lon: 128.7 },
    ]
    const box = { width: 1000, height: 1000, padding: 0 }
    const turned = fitProjection(line, { ...box, rotation: Math.PI / 2 })!
    const [a, b] = line.map((point) => turned.project(point))
    expect(Math.abs(a.x - b.x)).toBeLessThan(1e-6)
    expect(Math.abs(a.y - b.y)).toBeGreaterThan(100)
  })
})
