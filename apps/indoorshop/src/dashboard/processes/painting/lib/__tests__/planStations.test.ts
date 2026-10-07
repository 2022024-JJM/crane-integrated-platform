import { describe, expect, it } from 'vitest'
import { loadYardParcels } from '../../../../shared/entities/yard-parcels'
import { bayFrameOf, birdviewBaysOf, birdviewRotationOf } from '../../../../shared/features/equipment-birdview'
import { fitProjection } from '../../../../shared/features/equipment-birdview/lib/projection'
import {
  fetchEquipmentByFactory,
  paintingFactories,
} from '../../api/paintingRepository'
import type { AirUnit } from '../airEffect'
import { stationsOf } from '../bayStations'
import { loadPaintingFloorPlan } from '../floorPlan'
import { bayLocalToScreen, planStationPositions } from '../planStations'

/*
 * ── 도면과 3D 가 **같은 자리에** 설비를 세운다 (R45) ──
 *
 * 두 그림이 서로 다른 규칙으로 놓고 있었다 — 도면은 공용 청사진 배치(줄 세우기), 3D 는
 * 도장의 관례 자리(벽·코너). 그래서 같은 EQ039 가 한쪽에서는 베이 가운데, 다른 쪽에서는
 * 코너에 섰다. 나란히 두고 "저 대가 어디 있나"를 묻는 화면에서 그건 틀린 그림이다.
 *
 * 이 검사가 잠그는 것은 셋이다:
 *  ① 변환이 **거울까지 맞춘다** — 도면 평면(y = -lat)과 베이 로컬(y = +north) 사이에는
 *    늘 거울이 한 겹 끼어 있다. 그 한 겹을 놓치면 좌우가 뒤집힌 채 조용히 그려진다.
 *  ② 옮긴 자리가 **그 베이 안**이다 — 밖으로 나가면 설비가 이웃 칸에 선 것으로 읽힌다.
 *  ③ 두 그림의 **상대 배치가 같다** — 3D 에서 왼벽에 선 히터는 도면에서도 같은 쪽이다.
 */

/** 정사각형 껍질을 90° 돌리고 거울로 뒤집어 만든 화면 좌표 — 최악의 경우를 흉내낸다 */
describe('베이 로컬 → 도면 좌표 — 거울까지 맞춘다', () => {
  const local: [number, number][] = [
    [-10, -20],
    [10, -20],
    [10, 20],
    [-10, 20],
  ]

  it('회전·확대만 있는 짝을 정확히 맞춘다', () => {
    /* 90° 회전 + 2배 */
    const screen = local.map(([x, z]) => ({ x: -z * 2, y: x * 2 }))
    const toScreen = bayLocalToScreen(local, screen)
    expect(toScreen).not.toBeNull()
    for (let i = 0; i < local.length; i += 1) {
      const got = toScreen!({ x: local[i][0], z: local[i][1] })
      expect(got.x).toBeCloseTo(screen[i].x, 3)
      expect(got.y).toBeCloseTo(screen[i].y, 3)
    }
  })

  it('거울이 낀 짝도 맞춘다 — 도면 평면이 남북을 뒤집기 때문이다', () => {
    const screen = local.map(([x, z]) => ({ x, y: -z }))
    const toScreen = bayLocalToScreen(local, screen)
    expect(toScreen).not.toBeNull()
    for (let i = 0; i < local.length; i += 1) {
      const got = toScreen!({ x: local[i][0], z: local[i][1] })
      expect(got.x).toBeCloseTo(screen[i].x, 3)
      expect(got.y).toBeCloseTo(screen[i].y, 3)
    }
  })

  it('점이 모자라면 낼 것이 없다 — 억지로 맞추지 않는다', () => {
    expect(bayLocalToScreen([[0, 0]], [{ x: 1, y: 1 }])).toBeNull()
  })
})

/**
 * 이 칸의 **최소면적 직사각형** 안인가.
 *
 * 껍질(다각형) 안인지를 묻지 않는 이유: 자리를 정하는 규칙(`stationsOf`)이 베이를
 * 직사각형으로 보고 벽·코너를 잡기 때문이다. ㄱ자로 꺾인 칸(1DOCK B21)에서는 그
 * 직사각형의 한 귀퉁이가 실제 외곽 밖으로 나가고, 그 자리에 선 설비는 3D 에서도 같은
 * 자리에 선다 — 도면만의 문제가 아니라 **규칙의 성질**이다. 두 그림이 어긋나지 않는지가
 * 여기서 볼 것이므로, 규칙이 서는 틀(직사각형)을 기준으로 견준다.
 */
function insideFrame(
  point: { x: number; y: number },
  hull: readonly { x: number; y: number }[]
): boolean {
  const frame = bayFrameOf(hull)
  if (!frame) return false
  const dx = point.x - frame.cx
  const dy = point.y - frame.cy
  const u = dx * frame.ux + dy * frame.uy
  const v = dx * frame.vx + dy * frame.vy
  /* 1px 여유 — 벽에 붙는 자리라 부동소수 오차로 경계에 걸린다 */
  return Math.abs(u) <= frame.halfU + 1 && Math.abs(v) <= frame.halfV + 1
}

function unitsOf(factory: string): Map<string, AirUnit[]> {
  const byBay = new Map<string, AirUnit[]>()
  for (const item of fetchEquipmentByFactory(factory)) {
    const unit: AirUnit = {
      id: item.id,
      kind: item.kind,
      x: item.x,
      y: item.y,
      running: true,
      intensity: 0.5,
      value: 20,
      setpoint: 22,
    }
    const list = byBay.get(item.bay)
    if (list) list.push(unit)
    else byBay.set(item.bay, [unit])
  }
  return byBay
}

describe('도면 위 설비 자리 — 3D 와 한 규칙', () => {
  it.each(paintingFactories().map((name) => [name] as const))(
    '%s — 모든 설비가 제 베이 틀 안에 선다',
    async (factory) => {
      const parcels = await loadYardParcels()
      const bays = birdviewBaysOf(parcels.bays, factory)
      const projection = fitProjection(
        bays.flatMap((bay) => [...bay.hull]),
        { width: 1000, height: 600, padding: 18, rotation: birdviewRotationOf(bays) }
      )
      expect(projection).not.toBeNull()
      const projected = bays.map((bay) => ({
        groupKey: bay.groupKey,
        points: bay.hull.map(projection!.project),
      }))

      const unitsByBay = unitsOf(factory)
      const floor = await loadPaintingFloorPlan(factory, [...unitsByBay.keys()].sort())
      const placed = planStationPositions({ bays: projected, floor, unitsByBay })

      /* 설비가 있는 베이는 하나도 빠지지 않는다 */
      const total = [...unitsByBay.values()].reduce((sum, list) => sum + list.length, 0)
      expect(placed.size, `${factory} — 자리를 못 구한 설비가 있다`).toBe(total)

      const hullOf = new Map(projected.map((bay) => [bay.groupKey, bay.points]))
      const outside: string[] = []
      for (const [bay, units] of unitsByBay) {
        const hull = hullOf.get(bay)
        if (!hull) continue
        for (const unit of units) {
          const at = placed.get(unit.id)
          if (at && !insideFrame(at, hull)) outside.push(`${bay}/${unit.id}`)
        }
      }
      expect(outside, `${factory} — 제 베이 밖에 선 설비`).toEqual([])
    }
  )

  it('3D 의 좌우가 도면에서도 좌우다 — 같은 벽에 선 히터끼리 같은 쪽에 남는다', async () => {
    const factory = '1DOCK 도장공장'
    const parcels = await loadYardParcels()
    const bays = birdviewBaysOf(parcels.bays, factory)
    const projection = fitProjection(
      bays.flatMap((bay) => [...bay.hull]),
      { width: 1000, height: 600, padding: 18, rotation: birdviewRotationOf(bays) }
    )!
    const projected = bays.map((bay) => ({
      groupKey: bay.groupKey,
      points: bay.hull.map(projection.project),
    }))
    const unitsByBay = unitsOf(factory)
    const floor = await loadPaintingFloorPlan(factory, [...unitsByBay.keys()].sort())
    const placed = planStationPositions({ bays: projected, floor, unitsByBay })

    /*
     * 3D 의 베이 로컬과 도면의 화면 좌표를 **같은 변환**으로 견준다: 로컬에서 부호가
     * 갈리는 두 설비는 도면에서도 갈려야 한다. 절대 좌표가 아니라 **관계**를 본다 —
     * 도면은 회전·거울이 걸린 그림이라 좌표 자체는 견줄 수 없다.
     */
    let compared = 0
    for (const bayFloor of floor.bays) {
      const units = unitsByBay.get(bayFloor.bay)
      const hull = projected.find((bay) => bay.groupKey === bayFloor.bay)
      if (!units || !hull) continue
      const stations = stationsOf(units, bayFloor.size)
      const toScreen = bayLocalToScreen(bayFloor.footprint, hull.points)!
      for (const station of stations) {
        const expected = toScreen({ x: station.x, z: station.z })
        const got = placed.get(station.id)!
        expect(got.x).toBeCloseTo(expected.x, 6)
        expect(got.y).toBeCloseTo(expected.y, 6)
        compared += 1
      }
    }
    expect(compared, '견줄 설비가 있어야 한다').toBeGreaterThan(0)
  })
})
