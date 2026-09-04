import { describe, expect, it } from 'vitest'
import { loadYardParcels } from '../../../entities/yard-parcels'
import { birdviewBaysOf, birdviewPointsOf } from '../lib/fromEquipment'
import { fitProjection } from '../lib/projection'
import { birdviewRotationOf } from '../lib/orientation'
import { bayFrameOf, layoutBlueprint, type BlueprintBay, type BlueprintPoint } from '../lib/blueprint'

/*
 * 도면 배치의 계약 (R35).
 *
 * 이 계산이 지켜야 하는 것은 셋이다 — **줄이 맞고, 간격이 고르고, 아무것도 덮이지 않는다.**
 * 셋 중 하나라도 무너지면 그림은 다시 산점도가 되고, 조작자는 "몇 번째 자리냐"를
 * 그림에서 읽을 수 없게 된다.
 */

const GAP = 15

/** 화면 축과 나란한 직사각 베이 — 장변이 가로라 '한 줄'이 곧 같은 y 가 된다 */
function rectBay(groupKey: string, x0: number, y0: number, w: number, h: number): BlueprintBay {
  return {
    groupKey,
    hull: [
      { x: x0, y: y0 },
      { x: x0 + w, y: y0 },
      { x: x0 + w, y: y0 + h },
      { x: x0, y: y0 + h },
    ],
  }
}

function pointsOf(bay: string, typeId: string, count: number, spread = 3): BlueprintPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${typeId}-${i}`,
    typeId,
    bay,
    /* 실좌표는 일부러 흩어 놓는다 — 정렬이 데이터가 아니라 규칙에서 나와야 한다 */
    x: 120 + i * spread + (i % 2) * 7,
    y: 90 + (i % 3) * 4,
  }))
}

function minDistance(placed: Map<string, { x: number; y: number }>): number {
  const list = [...placed.values()]
  let worst = Infinity
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      worst = Math.min(worst, Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y))
    }
  }
  return worst
}

describe('bayFrameOf — 베이가 좌표계다', () => {
  it('기울어진 직사각형의 장변을 찾는다 (화면 축이 아니라 건물 축)', () => {
    /* 45° 기운 200×60 직사각형 */
    const c = Math.SQRT1_2
    const corners = [
      [0, 0],
      [200, 0],
      [200, 60],
      [0, 60],
    ].map(([x, y]) => ({ x: (x - 100) * c - (y - 30) * c, y: (x - 100) * c + (y - 30) * c }))
    const frame = bayFrameOf(corners)!
    expect(frame.halfU * 2).toBeCloseTo(200, 4)
    expect(frame.halfV * 2).toBeCloseTo(60, 4)
    /* u 는 45° 방향 */
    expect(Math.abs(frame.ux)).toBeCloseTo(c, 4)
    expect(Math.abs(frame.uy)).toBeCloseTo(c, 4)
    /* u ⟂ v */
    expect(frame.ux * frame.vx + frame.uy * frame.vy).toBeCloseTo(0, 8)
  })

  it('점이 셋을 못 채우면 좌표계를 만들지 않는다', () => {
    expect(bayFrameOf([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull()
  })
})

describe('layoutBlueprint — 같은 베이 같은 종류는 한 줄로 선다', () => {
  const bay = rectBay('1', 40, 40, 400, 120)

  it('같은 종류는 **같은 y** 에 정렬된다 (장변을 따라 한 줄)', () => {
    const placed = layoutBlueprint(pointsOf('1', 'LIDAR', 6), [bay], { minGap: GAP })
    const ys = [...placed.values()].map((p) => p.y)
    for (const y of ys) expect(y).toBeCloseTo(ys[0], 6)
  })

  it('그 줄은 **등간격**이다 — 실좌표가 들쭉날쭉해도', () => {
    const placed = layoutBlueprint(pointsOf('1', 'LIDAR', 6), [bay], { minGap: GAP })
    const xs = [...placed.values()].map((p) => p.x).sort((a, b) => a - b)
    const gaps = xs.slice(1).map((x, i) => x - xs[i])
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 6)
    expect(gaps[0]).toBeGreaterThanOrEqual(GAP)
  })

  it('종류가 다르면 **다른 줄**이다 — 캐비닛은 벽면, 관측류는 안쪽 (도면 관례)', () => {
    const placed = layoutBlueprint(
      [...pointsOf('1', 'LIDAR', 4), ...pointsOf('1', 'PNL', 2)],
      [bay],
      { minGap: GAP }
    )
    const lidarY = [...placed.entries()].filter(([id]) => id.startsWith('LIDAR')).map(([, p]) => p.y)
    const panelY = [...placed.entries()].filter(([id]) => id.startsWith('PNL')).map(([, p]) => p.y)
    for (const y of lidarY) expect(y).toBeCloseTo(lidarY[0], 6)
    for (const y of panelY) expect(y).toBeCloseTo(panelY[0], 6)
    expect(Math.abs(lidarY[0] - panelY[0])).toBeGreaterThanOrEqual(GAP)
    /* 캐비닛이 관측류보다 벽 쪽(위)에 선다 */
    expect(panelY[0]).toBeLessThan(lidarY[0])
  })

  it('한 줄에 다 못 서면 **열을 지킨 채 다음 줄**로 넘어간다 (흩뿌리지 않는다)', () => {
    /* 장변 100px 에 8대 — 눈금이 모자라 두 줄이 된다 */
    const narrow = rectBay('1', 0, 0, 100, 120)
    const placed = layoutBlueprint(pointsOf('1', 'LIDAR', 8), [narrow], { minGap: GAP })
    const rows = new Map<number, number[]>()
    for (const point of placed.values()) {
      const key = Math.round(point.y * 100)
      rows.set(key, [...(rows.get(key) ?? []), point.x])
    }
    expect(rows.size).toBeGreaterThan(1)
    /* 두 줄이 **같은 열**을 쓴다 — 아래 줄이 어긋나면 격자로 안 읽힌다 */
    const columns = [...rows.values()].map((xs) => xs.map((x) => Math.round(x * 100)).sort((a, b) => a - b))
    const widest = columns.reduce((a, b) => (a.length >= b.length ? a : b))
    for (const column of columns) {
      for (const x of column) expect(widest).toContain(x)
    }
  })

  it('결정적이다 — 입력 순서가 바뀌어도 같은 그림 (폴링마다 떨지 않는다)', () => {
    const input = [...pointsOf('1', 'LIDAR', 5), ...pointsOf('1', 'PNL', 3)]
    const forward = layoutBlueprint(input, [bay], { minGap: GAP })
    const reversed = layoutBlueprint([...input].reverse(), [bay], { minGap: GAP })
    for (const [id, at] of forward) {
      expect(reversed.get(id)!.x).toBeCloseTo(at.x, 9)
      expect(reversed.get(id)!.y).toBeCloseTo(at.y, 9)
    }
  })

  it('베이가 없는 설비도 **눈금 위**에 선다 — 옥외라고 흩뿌리지 않는다', () => {
    const placed = layoutBlueprint(
      [
        { id: 'a', typeId: 'DH', x: 301.4, y: 208.7 },
        { id: 'b', typeId: 'DH', x: 305.2, y: 209.1 },
      ],
      [],
      { minGap: GAP }
    )
    for (const at of placed.values()) {
      expect(at.x / GAP).toBeCloseTo(Math.round(at.x / GAP), 6)
      expect(at.y / GAP).toBeCloseTo(Math.round(at.y / GAP), 6)
    }
    expect(minDistance(placed)).toBeGreaterThanOrEqual(GAP - 1e-6)
  })

  it('모든 설비에 자리를 준다 — 조용히 빠지는 점이 없다', () => {
    const input = [...pointsOf('1', 'LIDAR', 5), { id: 'x', typeId: 'GH', x: 9, y: 9 }]
    expect(layoutBlueprint(input, [bay], { minGap: GAP }).size).toBe(input.length)
  })
})

/*
 * 실데이터 — **겹침 0**.
 *
 * 덮인 점은 없는 점이다. 이상이 하나 숨어 있어도 화면은 정상 하나를 보여 주므로,
 * 이 단언이 무너지면 그림이 거짓말을 하기 시작한다. 합성 데이터가 아니라 실제 공장의
 * 베이·설비로 못 박는다 — 겹침은 늘 실배치의 촘촘한 구석에서 터진다.
 */
const FACTORIES = [
  'PBS',
  'POS 1공장',
  '1DOCK 도장공장',
  /* 정사각에 가까운 칸이 모인 공장 — 회전각 가중이 길쭉함을 안 보면 33° 틀어진다 */
  '느태 도장공장',
  '두모 선행의장 2공장',
  '조립의장 1공장 BOS 1',
]

/** 화면이 하는 것과 **같은 순서**로 — 회전 보정된 투영 위에 배치한다 (R42) */
async function drawFactory(factory: string) {
  const parcels = await loadYardParcels()
  const bays = birdviewBaysOf(parcels.bays, factory)
  const points = birdviewPointsOf(factory, {
    severityOf: () => 'done',
    tooltipOf: (equipment) => ({ title: equipment.id, status: '-', freshness: '-' }),
  })
  const projection = fitProjection(
    [...bays.flatMap((bay) => [...bay.hull]), ...points.map((point) => point.position)],
    { width: 1000, height: 420, padding: 18, rotation: birdviewRotationOf(bays) }
  )!
  const projectedBays = bays.map((bay) => ({
    groupKey: bay.groupKey,
    hull: bay.hull.map(projection.project),
  }))
  const placed = layoutBlueprint(
    points.map((point) => ({
      id: point.id,
      typeId: point.typeId,
      bay: point.bay,
      ...projection.project(point.position),
    })),
    projectedBays,
    { minGap: GAP }
  )
  return { bays: projectedBays, points, placed }
}

describe('layoutBlueprint — 실공장에서 아이콘이 겹치지 않는다', () => {
  it.each(FACTORIES)('%s — 어떤 두 설비도 최소 간격 안으로 들어오지 않는다', async (factory) => {
    const { points, placed } = await drawFactory(factory)
    expect(placed.size).toBe(points.length)
    expect(minDistance(placed)).toBeGreaterThanOrEqual(GAP - 1e-6)
  })
})

/*
 * R42 — **도면은 똑바로 선다.**
 *
 * 회전 보정의 값은 눈으로만 확인되기 쉬운데, 그러면 다음 사람이 투영을 손볼 때 조용히
 * 기울어진다. 그래서 "베이가 축에 선다"를 계약으로 못 박는다 — 넓이의 대부분을 차지하는
 * 칸이 직각으로 서면 그 안의 설비 줄도 따라 선다.
 */
describe('회전 보정 — 베이가 축에 선다 (R42)', () => {
  it.each(FACTORIES)('%s — 넓은 베이의 장변이 가로(또는 세로)에 붙는다', async (factory) => {
    const { bays } = await drawFactory(factory)
    const frames = bays
      .map((bay) => bayFrameOf(bay.hull))
      .filter((frame): frame is NonNullable<typeof frame> => frame !== null)
    /* 넓이 상위 절반 — 구석의 작은 칸 하나까지 축에 서기를 요구하지는 않는다 */
    const major = frames
      .sort((a, b) => b.halfU * b.halfV - a.halfU * a.halfV)
      .slice(0, Math.max(1, Math.ceil(frames.length / 2)))
    for (const frame of major) {
      /* 장변이 화면 축과 이루는 각(0~90°) — 축에 서면 0 에 가깝다 */
      const deg = (Math.abs(Math.atan2(frame.uy, frame.ux)) * 180) / Math.PI
      const offAxis = Math.min(deg, Math.abs(deg - 90), Math.abs(deg - 180))
      expect(offAxis).toBeLessThan(8)
    }
  })

  it('회전을 걸지 않으면 기울어 있다 — 이 보정이 실제로 일을 한다', async () => {
    const parcels = await loadYardParcels()
    const bays = birdviewBaysOf(parcels.bays, 'PBS')
    /* 옥포 공장은 해안선을 따라 앉아 있어 북쪽 기준으로는 축에 서지 않는다 */
    expect(Math.abs(birdviewRotationOf(bays))).toBeGreaterThan(0.05)

    const flat = fitProjection(bays.flatMap((bay) => [...bay.hull]), {
      width: 1000,
      height: 420,
      padding: 18,
    })!
    const frame = bayFrameOf(bays[0].hull.map(flat.project))!
    const deg = (Math.abs(Math.atan2(frame.uy, frame.ux)) * 180) / Math.PI
    expect(Math.min(deg, Math.abs(deg - 90), Math.abs(deg - 180))).toBeGreaterThan(8)
  })
})
