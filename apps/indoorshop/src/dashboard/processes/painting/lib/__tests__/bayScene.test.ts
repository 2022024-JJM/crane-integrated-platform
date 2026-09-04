import { describe, expect, it } from 'vitest'
import { fetchEquipmentByFactory, paintingFactories } from '../../api/paintingRepository'
import { bayAirStatesOf, type BayAirState } from '../airEffect'
import { buildBayScene, estimateDrawCalls, type BayOccupant } from '../bayScene'
import { gridFloorPlan, loadPaintingFloorPlan } from '../floorPlan'
import { paintingOccupantsByBay } from '../collection'

/**
 * 가동 뷰가 세우는 **장면의 설계도** (R38).
 *
 * 3D 로 그린 것 자체는 jsdom 이 볼 수 없다(WebGL 이 없다). 그래서 그리기 전에 정해지는
 * 것 — 어느 베이가 어디에 서고, 설비가 어느 자리에 놓이고, 몇 콜이 드는가 — 을 여기서
 * 본다. 이 설계도가 맞으면 화면은 그것을 그리기만 한다.
 */

function heater(id: string, running = true): BayAirState['units'][number] {
  return { id, kind: '가스히터', x: 0, y: 0, running, intensity: running ? 0.6 : 0, value: 21, setpoint: 26 }
}

function airState(bay: string, units: BayAirState['units']): BayAirState {
  return {
    bay,
    mode: units.some((u) => u.running) ? 'heating' : 'idle',
    hazeIntensity: units.some((u) => u.running) ? 0.6 : 0,
    streakIntensity: 0,
    units,
    runningCount: units.filter((u) => u.running).length,
    env: { tempC: 21, tempSetpoint: 26, humidityRh: null, humiditySetpoint: null },
    bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
  }
}

describe('장면 설계도', () => {
  const floor = gridFloorPlan('테스트 공장', ['B1', 'B2', 'B3'])

  it('설비가 없는 베이도 선다 — 공장은 설비가 있는 면만으로 이루어지지 않는다', () => {
    const scene = buildBayScene({ floor, air: [airState('B1', [heater('GH1')])] })
    expect(scene.bayCount).toBe(3)
    expect(scene.activeBays).toBe(1)
    expect(scene.items.filter((item) => item.air === null)).toHaveLength(2)
  })

  it('설비가 선 베이에는 자리가 함께 정해진다', () => {
    const scene = buildBayScene({ floor, air: [airState('B2', [heater('GH1'), heater('GH2')])] })
    const b2 = scene.items.find((item) => item.bay === 'B2')!
    expect(b2.stations).toHaveLength(2)
    expect(scene.heaterCount).toBe(2)
  })

  it('재실 블록이 그 베이에 붙는다 — BTS 귀속이 근거다', () => {
    const occupants = new Map<string, BayOccupant[]>([
      ['B3', [{ key: '2543-141', projNo: '2543', blockNo: '141', justArrived: false }]],
    ])
    const scene = buildBayScene({ floor, air: [], occupants })
    expect(scene.items.find((item) => item.bay === 'B3')!.occupants).toHaveLength(1)
    expect(scene.items.find((item) => item.bay === 'B1')!.occupants).toHaveLength(0)
  })

  it('배치에 자리가 없는 베이는 고아로 보고한다 — 조용히 사라지지 않는다', () => {
    const scene = buildBayScene({ floor, air: [airState('없는베이', [heater('GH1')])] })
    expect(scene.orphanBays).toEqual(['없는베이'])
  })
})

describe('성능 계약 — draw call 은 베이 수에 비례해 폭증하지 않는다', () => {
  it('설비 대수가 늘어도 콜은 늘지 않는다 (종류당 InstancedMesh 하나)', () => {
    const floor = gridFloorPlan('테스트 공장', ['B1'])
    const few = buildBayScene({ floor, air: [airState('B1', [heater('GH1')])] })
    const many = buildBayScene({
      floor,
      air: [airState('B1', Array.from({ length: 40 }, (_, i) => heater(`GH${i}`)))],
    })
    expect(estimateDrawCalls(many)).toBe(estimateDrawCalls(few))
  })

  it('빈 베이는 콜을 만들지 않는다 — 바닥·구획선에 합쳐진다', () => {
    const one = buildBayScene({ floor: gridFloorPlan('T', ['B1']), air: [] })
    const twenty = buildBayScene({
      floor: gridFloorPlan('T', Array.from({ length: 20 }, (_, i) => `B${i + 1}`)),
      air: [],
    })
    expect(estimateDrawCalls(twenty)).toBe(estimateDrawCalls(one))
  })
})

describe('실데이터 — 도장 5개 공장이 전부 실형상 위에 선다', () => {
  it.each(paintingFactories())('%s', async (factory) => {
    const equipment = fetchEquipmentByFactory(factory)
    const air = bayAirStatesOf(equipment, new Map())
    const bays = [...new Set(equipment.map((item) => item.bay))]
    const floor = await loadPaintingFloorPlan(factory, bays)
    const scene = buildBayScene({ floor, air, occupants: paintingOccupantsByBay(factory) })

    /* 지번 fixture 에 도장 5개 공장의 베이가 전부 있다 — 격자로 물러설 일이 없어야 한다 */
    expect(scene.source).toBe('yard-fixture')
    /* 설비가 선 베이가 배치에서 빠지면 화면이 그 설비를 통째로 잃는다 */
    expect(scene.orphanBays).toEqual([])
    expect(scene.activeBays).toBe(air.length)
    expect(scene.heaterCount + scene.dryerCount).toBe(equipment.length)
    /* 베이는 큐브가 아니다 — 실측 도장 베이는 한 변이 20m 를 넘는다 */
    for (const item of scene.items) {
      expect(Math.min(...item.size)).toBeGreaterThan(20)
    }
    /* 가장 큰 공장에서도 콜 어림수는 사람이 셀 수 있는 범위 안이다 */
    expect(estimateDrawCalls(scene)).toBeLessThanOrEqual(80)
  })
})
