import { describe, expect, it } from 'vitest'
import { loadYardParcels } from '../../../entities/yard-parcels'
import { factoryBayOccupancy } from '../lib/bayOccupancy'
import { isWorking, loadOccupantProgress, occupantProgressKey } from '../lib/occupantProgress'

/*
 * 놓였다고 작업 중인 것은 아니다 — 카드의 상태는 실적 원천이 정한다.
 * (사고: 3DS 1BAY 에 자리만 잡힌 2543-642 의 M03·S04 가 판별 0 인데 '작업 중' 으로 섰다)
 */
const BASE = '2026-10-20'

describe('loadOccupantProgress', () => {
  it('판별이 하나도 서지 않은 자리는 작업 전이다 — 3DS 1BAY 의 2543-642', async () => {
    const parcels = await loadYardParcels()
    const bay = factoryBayOccupancy(parcels, '3DS').find((row) => row.bayId === '3DS#1')!
    const occupant = bay.occupants.find((o) => o.key === '2543-642')!
    const progress = await loadOccupantProgress([occupant], BASE)
    const state = progress.get(occupantProgressKey(occupant))!
    expect(state.state).toBe('notStarted')
    expect(isWorking(state)).toBe(false)
  })

  it('갓 반입은 실적과 무관하게 작업 전', async () => {
    const progress = await loadOccupantProgress(
      [{ key: '1-1', projNo: '1', blockNo: '1', zone: 'painting', assys: [], justArrived: true, path: '/' }],
      BASE
    )
    expect([...progress.values()][0].state).toBe('notStarted')
  })

  it('아직 모르는 자리(로딩 중)는 진행으로 세어 둔다 — 숫자가 0 에서 튀지 않게', () => {
    expect(isWorking(undefined)).toBe(true)
    expect(isWorking({ state: 'done', pct: 100 })).toBe(false)
  })
})
