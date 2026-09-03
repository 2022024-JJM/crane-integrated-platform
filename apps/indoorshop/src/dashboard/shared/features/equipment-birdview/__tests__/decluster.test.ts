import { describe, expect, it } from 'vitest'
import { declusterPoints } from '../lib/decluster'

/*
 * 겹침 떼어놓기 — 이 계산이 지켜야 하는 것은 둘뿐이다.
 * **덮인 점을 드러내되, 자리를 지어내지 않는다.**
 */
describe('declusterPoints', () => {
  const opts = { minGap: 10, maxShift: 6 }

  it('겹친 두 점을 최소 간격만큼 벌린다', () => {
    const out = declusterPoints(
      [
        { id: 'a', x: 100, y: 100 },
        { id: 'b', x: 103, y: 100 },
      ],
      opts
    )
    const [a, b] = out
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(9.9)
  })

  it('완전히 같은 자리도 갈라진다 — 한 점만 보이면 나머지는 없는 점이다', () => {
    const out = declusterPoints(
      [
        { id: 'a', x: 50, y: 50 },
        { id: 'b', x: 50, y: 50 },
        { id: 'c', x: 50, y: 50 },
      ],
      opts
    )
    const seen = new Set(out.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`))
    expect(seen.size).toBe(3)
  })

  it('원래 자리에서 maxShift 를 넘지 않는다 — 겹침보다 거짓 위치가 나쁘다', () => {
    const dense = Array.from({ length: 12 }, (_, i) => ({ id: `e${i}`, x: 200, y: 200 + i * 0.5 }))
    for (const moved of declusterPoints(dense, opts)) {
      const origin = dense.find((p) => p.id === moved.id)!
      expect(Math.hypot(moved.x - origin.x, moved.y - origin.y)).toBeLessThanOrEqual(6.0001)
    }
  })

  it('결정적이다 — 같은 입력은 늘 같은 결과 (폴링마다 점이 떨리지 않는다)', () => {
    const input = [
      { id: 'a', x: 10, y: 10 },
      { id: 'b', x: 11, y: 10 },
      { id: 'c', x: 10.5, y: 11 },
    ]
    expect(declusterPoints(input, opts)).toEqual(declusterPoints(input, opts))
  })

  it('입력 순서가 달라도 결과는 같다 — 정렬이 id 로 고정돼 있다', () => {
    const input = [
      { id: 'a', x: 10, y: 10 },
      { id: 'b', x: 11, y: 10 },
      { id: 'c', x: 10.5, y: 11 },
    ]
    const forward = declusterPoints(input, opts)
    const reversed = declusterPoints([...input].reverse(), opts)
    for (const point of forward) {
      const mate = reversed.find((p) => p.id === point.id)!
      expect(mate.x).toBeCloseTo(point.x, 6)
      expect(mate.y).toBeCloseTo(point.y, 6)
    }
  })

  it('반환 순서는 입력 순서 그대로다 (그리는 쪽의 정렬을 흔들지 않는다)', () => {
    const input = [
      { id: 'z', x: 0, y: 0 },
      { id: 'a', x: 1, y: 0 },
    ]
    expect(declusterPoints(input, opts).map((p) => p.id)).toEqual(['z', 'a'])
  })

  it('이미 떨어져 있으면 건드리지 않는다', () => {
    const input = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 100, y: 100 },
    ]
    expect(declusterPoints(input, opts)).toEqual(input)
  })
})
