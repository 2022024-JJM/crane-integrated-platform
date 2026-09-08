import { describe, expect, it } from 'vitest'
import { buildMockFactoryLayout } from '../lib/bayLayout'
import { BAY_LENGTH, BAY_WIDTH } from '../lib/bayConfig'
import type { Location } from '../../../entities/location/model/types'

/*
 * 목업 배치 계약만 여기서 검증한다 — 실형상(yard-fixture) 파생은 공정 fixture(조립
 * 공장명)에 종속되므로 `processes/assembly/api/__tests__/yardLayout.test.ts` 가 맡는다.
 */

function locations(count: number): Location[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `f1-b${i + 1}`,
    factoryId: 'f1',
    name: `${i + 1}번 베이`,
    status: 'empty' as const,
    workCntr: `WC${i + 1}`,
  }))
}

describe('buildMockFactoryLayout — 목업 배치 계약 (FR-3)', () => {
  it('목업임을 데이터 수준에서 명시한다', () => {
    expect(buildMockFactoryLayout('f1', locations(3)).source).toBe('mock')
  })

  it('베이 id·이름·정반코드를 보존하고 크기는 규약 상수를 따른다', () => {
    const layout = buildMockFactoryLayout('f1', locations(2))
    expect(layout.bays.map((b) => b.bayId)).toEqual(['f1-b1', 'f1-b2'])
    expect(layout.bays[0].size).toEqual([BAY_WIDTH, BAY_LENGTH])
  })

  it('열당 4면을 넘으면 통로를 사이에 둔 다음 열로 넘어간다', () => {
    const layout = buildMockFactoryLayout('f1', locations(6))
    const zs = new Set(layout.bays.map((b) => b.center[1]))
    expect(zs.size).toBe(2)
    const [z1, z2] = [...zs].sort((a, b) => a - b)
    // 열 간 거리 = 베이 길이 + 통로 폭 — 통로 관계가 배치에 남는다
    expect(z2 - z1).toBeCloseTo(BAY_LENGTH + layout.aisleWidth)
  })

  it('전체 배치는 원점 중심으로 정렬된다', () => {
    const layout = buildMockFactoryLayout('f1', locations(4))
    const meanX = layout.bays.reduce((s, b) => s + b.center[0], 0) / layout.bays.length
    expect(meanX).toBeCloseTo(0)
    expect(layout.bays[0].center[1]).toBeCloseTo(0)
  })

  it('베이가 겹치지 않는다 — 중심 간 거리가 폭 이상', () => {
    const layout = buildMockFactoryLayout('f1', locations(4))
    for (let i = 0; i < layout.bays.length; i++) {
      for (let j = i + 1; j < layout.bays.length; j++) {
        const [ax, az] = layout.bays[i].center
        const [bx, bz] = layout.bays[j].center
        const overlapX = Math.abs(ax - bx) < BAY_WIDTH
        const overlapZ = Math.abs(az - bz) < BAY_LENGTH
        expect(overlapX && overlapZ).toBe(false)
      }
    }
  })
})
