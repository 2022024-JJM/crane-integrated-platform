import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { BayAirState } from '../../lib/airEffect'
import { buildBayScene, type BaySceneItem } from '../../lib/bayScene'
import { gridFloorPlan } from '../../lib/floorPlan'
import {
  DRYER_STREAMLINES,
  HEATER_STREAMLINES,
  HEAT_RISE_M,
  REACH_MAX_M,
  REACH_MIN_M,
  STREAMLINE_SAMPLES,
  buildParticleGeometry,
  buildRibbonGeometry,
  dryerStreamline,
  floorFieldMatrix,
  flowUnitOf,
  flowUnitsOf,
  heaterStreamline,
} from '../airFlowField'

/**
 * 기류장(R44) — 공기의 **길**이 규칙대로 나는가.
 *
 * 셰이더가 만드는 움직임은 WebGL 없이 볼 수 없다. 그래서 여기서 잠그는 것은 길의 기하다:
 * 히터의 유선은 토출구에서 시작해 앞으로 가며 **뜨고**, 제습기의 유선은 베이 안쪽에서
 * 시작해 흡입구로 **모이며**, 둘 다 베이를 벗어나지 않는다. 합친 지오메트리의 구간 표
 * (`ranges`·`blocks`)는 폴링이 세기를 다시 쓰는 열쇠이므로 정점 수와 맞아야 한다.
 */
function unit(id: string, kind: '가스히터' | '제습기'): BayAirState['units'][number] {
  return { id, kind, x: 0, y: 0, running: true, intensity: 0.7, value: 20, setpoint: 25 }
}

function bay(name: string, units: BayAirState['units']): BayAirState {
  return {
    bay: name,
    mode: 'mixed',
    hazeIntensity: 0.7,
    streakIntensity: 0.7,
    units,
    runningCount: units.length,
    env: { tempC: 20, tempSetpoint: 25, humidityRh: 60, humiditySetpoint: 50 },
    bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
  }
}

function sceneOf(air: BayAirState[]): BaySceneItem[] {
  return buildBayScene({ floor: gridFloorPlan('T', air.map((a) => a.bay)), air }).items
}

const ITEMS = sceneOf([bay('B1', [unit('H1', '가스히터'), unit('D1', '제습기')])])
const HEATER = flowUnitOf(ITEMS[0], 0, ITEMS[0].stations.find((s) => s.kind === '가스히터')!)
const DRYER = flowUnitOf(ITEMS[0], 0, ITEMS[0].stations.find((s) => s.kind === '제습기')!)

function insideBay(item: BaySceneItem, x: number, z: number, slack = 2): boolean {
  const [w, l] = item.size
  const dx = x - item.center[0]
  const dz = z - item.center[1]
  return Math.abs(dx) <= w / 2 + slack && Math.abs(dz) <= l / 2 + slack
}

describe('기류 단위 — 자리와 형상에서 원점·방향·거리를 만든다', () => {
  it('보는 방향은 단위 벡터이고 베이 안쪽을 향한다', () => {
    for (const flow of [HEATER, DRYER]) {
      const [fx, fz] = flow.forward
      expect(Math.hypot(fx, fz)).toBeCloseTo(1, 5)
      /* 원점에서 보는 방향으로 한참 가도 베이 안이다 = 안쪽을 본다 */
      const ahead = [flow.origin[0] + fx * 10, flow.origin[2] + fz * 10]
      expect(insideBay(ITEMS[0], ahead[0], ahead[1])).toBe(true)
    }
  })

  it('닿는 거리는 상·하한 안이다', () => {
    for (const flow of [HEATER, DRYER]) {
      expect(flow.reach).toBeGreaterThanOrEqual(REACH_MIN_M)
      expect(flow.reach).toBeLessThanOrEqual(REACH_MAX_M)
    }
  })

  it('설비가 없는 베이는 기류 단위를 내지 않는다', () => {
    const items = buildBayScene({ floor: gridFloorPlan('T', ['B1', 'B2']), air: [ITEMS[0].air!] }).items
    const units = flowUnitsOf(items)
    expect(units.every((u) => u.bay === 'B1')).toBe(true)
    expect(units).toHaveLength(2)
  })
})

describe('히터 유선 — 토출구에서 앞으로 퍼지며 뜬다', () => {
  it('토출구에서 시작해 닿는 거리까지 간다', () => {
    const line = heaterStreamline(HEATER, 2, HEATER_STREAMLINES)
    expect(line).toHaveLength(STREAMLINE_SAMPLES)
    expect(line[0].x).toBeCloseTo(HEATER.origin[0], 5)
    expect(line[0].z).toBeCloseTo(HEATER.origin[2], 5)
    const last = line[line.length - 1]
    const travelled = Math.hypot(last.x - HEATER.origin[0], last.z - HEATER.origin[2])
    expect(travelled).toBeCloseTo(HEATER.reach, 0)
  })

  it('높이가 단조 증가해 끝에서 열기 높이만큼 뜬다', () => {
    const line = heaterStreamline(HEATER, 0, HEATER_STREAMLINES)
    for (let i = 1; i < line.length; i += 1) expect(line[i].y).toBeGreaterThanOrEqual(line[i - 1].y)
    expect(line[line.length - 1].y - line[0].y).toBeCloseTo(HEAT_RISE_M, 5)
  })

  it('가장자리 유선은 좌우로 벌어지고 가운데 유선은 곧다', () => {
    const left = heaterStreamline(HEATER, 0, HEATER_STREAMLINES)
    const right = heaterStreamline(HEATER, HEATER_STREAMLINES - 1, HEATER_STREAMLINES)
    const l = left[left.length - 1]
    const r = right[right.length - 1]
    expect(Math.hypot(l.x - r.x, l.z - r.z)).toBeGreaterThan(HEATER.reach * 0.5)
  })

  it('띠 폭은 멀어질수록 넓다', () => {
    const line = heaterStreamline(HEATER, 1, HEATER_STREAMLINES)
    expect(line[line.length - 1].width).toBeGreaterThan(line[0].width)
  })

  it('베이를 벗어나지 않는다', () => {
    for (let i = 0; i < HEATER_STREAMLINES; i += 1) {
      for (const p of heaterStreamline(HEATER, i, HEATER_STREAMLINES)) {
        expect(insideBay(ITEMS[0], p.x, p.z)).toBe(true)
      }
    }
  })
})

describe('제습기 유선 — 베이 안쪽에서 흡입구로 모인다', () => {
  it('끝점이 흡입구다', () => {
    const line = dryerStreamline(DRYER, 0, DRYER_STREAMLINES)
    const last = line[line.length - 1]
    expect(last.x).toBeCloseTo(DRYER.origin[0], 5)
    expect(last.y).toBeCloseTo(DRYER.origin[1], 5)
    expect(last.z).toBeCloseTo(DRYER.origin[2], 5)
  })

  it('흡입구까지의 거리가 단조 감소한다 — 흐름은 t 가 커지는 쪽이다', () => {
    const line = dryerStreamline(DRYER, 3, DRYER_STREAMLINES)
    const dist = (p: { x: number; z: number }) =>
      Math.hypot(p.x - DRYER.origin[0], p.z - DRYER.origin[2])
    for (let i = 1; i < line.length; i += 1) expect(dist(line[i])).toBeLessThanOrEqual(dist(line[i - 1]))
  })

  it('띠 폭은 흡입구로 갈수록 좁다', () => {
    const line = dryerStreamline(DRYER, 0, DRYER_STREAMLINES)
    expect(line[0].width).toBeGreaterThan(line[line.length - 1].width)
  })

  it('베이를 벗어나지 않는다', () => {
    for (let i = 0; i < DRYER_STREAMLINES; i += 1) {
      for (const p of dryerStreamline(DRYER, i, DRYER_STREAMLINES)) {
        expect(insideBay(ITEMS[0], p.x, p.z)).toBe(true)
      }
    }
  })
})

describe('합친 지오메트리 — 구간 표가 정점과 맞는다', () => {
  const units = flowUnitsOf(
    sceneOf([
      bay('B1', [unit('H1', '가스히터'), unit('H2', '가스히터'), unit('D1', '제습기')]),
      bay('B2', [unit('H3', '가스히터')]),
    ])
  )

  it('리본은 종류의 설비마다 유선 수 × 표본 × 2 정점이다', () => {
    const { geometry, ranges } = buildRibbonGeometry(units, '가스히터')
    const heaters = units.filter((u) => u.kind === '가스히터')
    const perUnit = HEATER_STREAMLINES * STREAMLINE_SAMPLES * 2
    expect(geometry.getAttribute('position').count).toBe(heaters.length * perUnit)
    expect(ranges).toHaveLength(heaters.length)
    for (const range of ranges) {
      expect(range.count).toBe(perUnit)
      expect(units[range.unitIndex].kind).toBe('가스히터')
    }
    /* 구간은 서로 겹치지 않고 전체를 덮는다 */
    const covered = ranges.reduce((sum, r) => sum + r.count, 0)
    expect(covered).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aIntensity').count).toBe(covered)
  })

  it('다른 종류가 하나도 없으면 빈 리본이다 — 터지지 않는다', () => {
    const { geometry, ranges } = buildRibbonGeometry(
      units.filter((u) => u.kind === '가스히터'),
      '제습기'
    )
    expect(geometry.getAttribute('position').count).toBe(0)
    expect(ranges).toEqual([])
  })

  it('입자는 베이마다 상한 블록을 잡고, 블록 안 정점은 그 베이의 설비에 돌아가며 붙는다', () => {
    const { geometry, blocks } = buildParticleGeometry(units, '가스히터', 8)
    expect(blocks.map((b) => b.bayIndex)).toEqual([0, 1])
    expect(geometry.getAttribute('position').count).toBe(16)
    const origin = geometry.getAttribute('aOrigin')
    const b1 = units.filter((u) => u.kind === '가스히터' && u.bayIndex === 0)
    /* 첫 블록의 정점 0·1 은 B1 의 히터 둘에 번갈아 붙는다 */
    expect(origin.getX(0)).toBeCloseTo(b1[0].origin[0], 5)
    expect(origin.getX(1)).toBeCloseTo(b1[1].origin[0], 5)
    /* 켜짐·세기는 처음에 전부 0 — 값 갱신이 채운다 */
    expect(geometry.getAttribute('aOn').getX(0)).toBe(0)
    expect(geometry.getAttribute('aIntensity').getX(0)).toBe(0)
  })

  it('바닥장 변환은 설비 앞으로 닿는 거리만큼 늘린다', () => {
    const matrix = floorFieldMatrix(HEATER, new THREE.Matrix4())
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    matrix.decompose(position, quaternion, scale)
    expect(position.x).toBeCloseTo(HEATER.origin[0], 5)
    expect(position.z).toBeCloseTo(HEATER.origin[2], 5)
    expect(scale.z).toBeCloseTo(HEATER.reach, 5)
    /* 판의 +z 가 보는 방향으로 돈다 */
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion)
    expect(forward.x).toBeCloseTo(HEATER.forward[0], 5)
    expect(forward.z).toBeCloseTo(HEATER.forward[1], 5)
  })
})
