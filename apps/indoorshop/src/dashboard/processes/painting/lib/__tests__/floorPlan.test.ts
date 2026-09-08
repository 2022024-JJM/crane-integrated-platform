import { describe, expect, it } from 'vitest'
import {
  GRID_BAY_GAP,
  GRID_BAY_SIZE,
  floorPlanFromHulls,
  gridFloorPlan,
  type BayHullInput,
} from '../floorPlan'

/**
 * 공장 **바닥 배치** (R38) — 베이가 실형상으로, 실제 자리에 선다.
 *
 * 예전 가동 뷰의 베이는 설비 좌표의 외접 상자였다(=8m 큐브). 도장 베이는 실제로 한 면이
 * 50~60m 이고, 그 사실이 화면에 없으면 "큐브만 가져다 둔" 그림이 된다. 여기서 잠그는 것은
 * 그 변환이 **실측 껍질을 왜곡 없이 옮기는가**이다.
 */

const LAT0 = 34.87
const M_PER_DEG = 111_320
const cosLat = Math.cos((LAT0 * Math.PI) / 180)

/** 남북 `long` m × 동서 `short` m 짜리 직사각 베이 하나 (중심 offset 은 미터) */
function rectBay(
  bay: string,
  short: number,
  long: number,
  offsetEast = 0,
  offsetNorth = 0
): BayHullInput {
  const dLat = long / 2 / M_PER_DEG
  const dLon = short / 2 / (M_PER_DEG * cosLat)
  const lat = LAT0 + offsetNorth / M_PER_DEG
  const lon = 128.69 + offsetEast / (M_PER_DEG * cosLat)
  return {
    bay,
    label: `${bay}BAY`,
    hull: [
      { lat: lat - dLat, lon: lon - dLon },
      { lat: lat - dLat, lon: lon + dLon },
      { lat: lat + dLat, lon: lon + dLon },
      { lat: lat + dLat, lon: lon - dLon },
    ],
  }
}

describe('실형상 배치 — 껍질을 미터로 옮긴다', () => {
  it('베이 크기가 실측 그대로다 (짧은 변, 긴 변)', () => {
    const plan = floorPlanFromHulls('테스트 공장', [rectBay('A1', 40, 60)])
    expect(plan).not.toBeNull()
    const [short, long] = plan!.bays[0].size
    expect(short).toBeCloseTo(40, 0)
    expect(long).toBeCloseTo(60, 0)
    expect(plan!.source).toBe('yard-fixture')
  })

  it('공장 축이 베이 긴 축을 따른다 — 회전이 0 에 가깝다', () => {
    const plan = floorPlanFromHulls('테스트 공장', [
      rectBay('A1', 40, 60),
      rectBay('A2', 40, 60, 60),
    ])
    for (const bay of plan!.bays) expect(Math.abs(bay.rotationDeg)).toBeLessThan(1)
  })

  it('베이 사이 거리가 실측 그대로다 — 배치가 뭉개지지 않는다', () => {
    const plan = floorPlanFromHulls('테스트 공장', [
      rectBay('A1', 40, 60),
      rectBay('A2', 40, 60, 70),
    ])
    const [a, b] = plan!.bays
    const distance = Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1])
    expect(distance).toBeCloseTo(70, 0)
  })

  it('발자국은 베이 로컬이다 — 중심이 원점이라 뷰어가 group 으로 옮긴다', () => {
    const plan = floorPlanFromHulls('테스트 공장', [rectBay('A1', 40, 60, 500, 300)])
    const footprint = plan!.bays[0].footprint
    const cx = footprint.reduce((s, p) => s + p[0], 0) / footprint.length
    const cz = footprint.reduce((s, p) => s + p[1], 0) / footprint.length
    expect(cx).toBeCloseTo(0, 1)
    expect(cz).toBeCloseTo(0, 1)
  })

  it('베이 이름 순으로 낸다 (숫자 섞임 고려) — 자리가 렌더마다 바뀌지 않게', () => {
    const plan = floorPlanFromHulls('테스트 공장', [
      rectBay('B10', 40, 60, 120),
      rectBay('B2', 40, 60, 60),
      rectBay('B1', 40, 60),
    ])
    expect(plan!.bays.map((b) => b.bay)).toEqual(['B1', 'B2', 'B10'])
  })

  it('껍질이 모자라면 null — 반쪽 실형상은 반쪽 거짓말이다', () => {
    expect(floorPlanFromHulls('테스트 공장', [])).toBeNull()
    expect(
      floorPlanFromHulls('테스트 공장', [
        { bay: 'A1', label: 'A1BAY', hull: [{ lat: LAT0, lon: 128.69 }] },
      ])
    ).toBeNull()
  })
})

describe('격자 갈음 — fixture 가 그 공장을 모를 때만', () => {
  it('실형상이 아니라는 사실이 남는다', () => {
    expect(gridFloorPlan('모르는 공장', ['B1']).source).toBe('grid')
  })

  it('같은 크기로 등간격이다', () => {
    const plan = gridFloorPlan('모르는 공장', ['B1', 'B2', 'B3', 'B4'])
    expect(plan.bays).toHaveLength(4)
    for (const bay of plan.bays) expect(bay.size).toEqual([...GRID_BAY_SIZE])
    const xs = [...new Set(plan.bays.map((b) => b.center[0]))].sort((a, b) => a - b)
    expect(xs[1] - xs[0]).toBeCloseTo(GRID_BAY_SIZE[0] + GRID_BAY_GAP, 6)
  })

  it('베이 이름 순이다', () => {
    expect(gridFloorPlan('모르는 공장', ['B10', 'B2', 'B1']).bays.map((b) => b.bay)).toEqual([
      'B1',
      'B2',
      'B10',
    ])
  })
})
