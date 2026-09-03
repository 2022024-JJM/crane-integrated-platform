import { describe, expect, it } from 'vitest'
import type { YardParcelLot } from '../../../entities/yard-parcels'
import {
  createMinimapBaseCache,
  drawMinimapBase,
  minimapBaseKey,
  minimapProjection,
  type Minimal2DContext,
  type MinimapBaseInput,
} from '../lib/minimapBase'

/**
 * 미니맵 바탕 캐시 — **내용이 바뀔 때만 다시 그리는가**, 그리고 **그림이 같은가**.
 *
 * 캐시의 위험은 하나다: 바뀐 것을 안 바뀌었다고 우겨 낡은 그림을 보여 주는 것. 그래서
 * "몇 번 다시 그렸나"와 "무엇이 바뀌면 반드시 다시 그리나"를 같은 무게로 본다.
 */

/** 그린 명령을 받아 적는 가짜 컨텍스트 */
function recordingContext() {
  const calls: string[] = []
  const ctx: Minimal2DContext = {
    setTransform: () => calls.push('setTransform'),
    clearRect: () => calls.push('clearRect'),
    fillRect: () => calls.push('fillRect'),
    beginPath: () => calls.push('beginPath'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    closePath: () => calls.push('closePath'),
    fill: () => calls.push('fill'),
    fillStyle: '',
    globalAlpha: 1,
  }
  return { ctx, calls }
}

const lot = (id: string, process: string): YardParcelLot => ({
  lot: id,
  factory: 'PBS',
  process,
  category: '공장(Shop)',
  label: id,
  area: 100,
  place: '옥내',
  polygon: [
    { lat: 34.87, lon: 128.7 },
    { lat: 34.871, lon: 128.701 },
    { lat: 34.872, lon: 128.7 },
  ],
})

const input = (over: Partial<MinimapBaseInput> = {}): MinimapBaseInput => ({
  extent: { minLat: 34.86, minLon: 128.69, maxLat: 34.88, maxLon: 128.71 },
  lots: [lot('A', '조립'), lot('B', '도장')],
  width: 224,
  height: 136,
  dpr: 2,
  pad: 8,
  ...over,
})

describe('바탕 그리기', () => {
  it('배경 한 번 + 지번마다 폴리곤 하나를 그린다', () => {
    const { ctx, calls } = recordingContext()
    drawMinimapBase(ctx, input())
    expect(calls.filter((c) => c === 'beginPath')).toHaveLength(2)
    expect(calls.filter((c) => c === 'fill')).toHaveLength(2)
    expect(calls[0]).toBe('setTransform')
  })

  it('공장 없는 지번·점이 모자란 폴리곤은 건너뛴다 (기존 규칙 그대로)', () => {
    const { ctx, calls } = recordingContext()
    drawMinimapBase(
      ctx,
      input({
        lots: [
          { ...lot('A', '조립'), factory: null },
          { ...lot('B', '조립'), polygon: [{ lat: 34.87, lon: 128.7 }] },
        ],
      })
    )
    expect(calls.filter((c) => c === 'fill')).toHaveLength(0)
  })

  it('투영은 여백 안쪽으로 접는다 — 바탕과 사각형이 같은 잣대를 쓴다', () => {
    const project = minimapProjection(input())
    expect(project.x(128.69)).toBeCloseTo(8, 5)
    expect(project.x(128.71)).toBeCloseTo(224 - 8, 5)
    expect(project.y(34.88)).toBeCloseTo(8, 5)
    expect(project.y(34.86)).toBeCloseTo(136 - 8, 5)
  })
})

describe('바탕 캐시 — 내용이 바뀔 때만 다시 그린다', () => {
  function cacheHarness() {
    let created = 0
    const cache = createMinimapBaseCache<{ id: number }>(() => {
      created += 1
      return { canvas: { id: created }, ctx: recordingContext().ctx }
    })
    return { cache, created: () => created }
  }

  it('같은 입력이면 100번을 불러도 한 번만 그린다', () => {
    const { cache } = cacheHarness()
    const fixed = input()
    for (let i = 0; i < 100; i += 1) cache.surfaceFor(fixed)
    expect(cache.rebuildCount()).toBe(1)
  })

  it('같은 입력이면 같은 바탕을 돌려준다', () => {
    const { cache } = cacheHarness()
    const fixed = input()
    expect(cache.surfaceFor(fixed)).toBe(cache.surfaceFor(fixed))
  })

  it('캔버스 크기가 바뀌면 다시 그린다', () => {
    const { cache } = cacheHarness()
    cache.surfaceFor(input())
    cache.surfaceFor(input({ width: 148 }))
    expect(cache.rebuildCount()).toBe(2)
  })

  it('픽셀 밀도가 바뀌면 다시 그린다 — 흐린 바탕을 그대로 쓰지 않는다', () => {
    const { cache } = cacheHarness()
    cache.surfaceFor(input())
    cache.surfaceFor(input({ dpr: 1 }))
    expect(cache.rebuildCount()).toBe(2)
  })

  it('범위가 바뀌면 다시 그린다', () => {
    const { cache } = cacheHarness()
    cache.surfaceFor(input())
    cache.surfaceFor(input({ extent: { minLat: 34.8, minLon: 128.6, maxLat: 34.9, maxLon: 128.8 } }))
    expect(cache.rebuildCount()).toBe(2)
  })

  it('지번 자료가 갈리면 다시 그린다 — 낡은 지도를 보여 주지 않는다', () => {
    const { cache } = cacheHarness()
    const first = input()
    cache.surfaceFor(first)
    /* 개수는 같지만 다른 배열 — 자료가 갈린 경우다 */
    cache.surfaceFor(input({ lots: [lot('A', '조립'), lot('C', '가공')] }))
    expect(cache.rebuildCount()).toBe(2)
  })

  it('열쇠는 크기·밀도·범위·지번 수를 담는다', () => {
    expect(minimapBaseKey(input())).not.toBe(minimapBaseKey(input({ dpr: 1 })))
    expect(minimapBaseKey(input())).not.toBe(minimapBaseKey(input({ width: 100 })))
    expect(minimapBaseKey(input())).toBe(minimapBaseKey(input()))
  })

  it('2D 컨텍스트가 없는 환경에서는 null 을 주고 죽지 않는다 — 호출부가 직접 그린다', () => {
    const cache = createMinimapBaseCache<HTMLCanvasElement>(() => null)
    expect(cache.surfaceFor(input())).toBeNull()
    expect(cache.rebuildCount()).toBe(0)
  })
})
