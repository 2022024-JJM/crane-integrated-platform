import * as THREE from 'three'
import type { BaySceneItem } from '../lib/bayScene'
import type { UnitStation } from '../lib/bayStations'
import { EQUIPMENT_SYMBOL_SCALE, emitPointOf } from './equipmentShapes'

/*
 * 가동 뷰의 **기류장(氣流場)** — 설비가 만드는 공기의 길을 지오메트리로 적는다 (R44).
 *
 * 예전 파티클은 히터 자리에서 **수직으로** 피어오르고 제습기로는 **사방에서** 빨려들었다.
 * 그 그림은 "켜져 있다"까지만 말했다. 실제 공기는 방향이 있다 — 히터는 토출구가 보는
 * 쪽으로 불고, 제습기는 흡입구 앞의 공기를 끌어당긴다. 기류가 **어디서 어디로** 가는지가
 * 보여야 베이 안에 그 공기가 "적용되고 있다"고 읽힌다.
 *
 * 세 겹으로 그린다. 이 파일은 그 세 겹의 **지오메트리**만 만들고, 움직임은 셰이더가
 * (`ui/airMaterials`) 시간 uniform 으로 만든다 — CPU 는 프레임마다 정점을 만지지 않는다.
 *  · **유선(流線) 리본** — 토출구에서 부채꼴로 퍼져 나가며 떠오르는(히터) / 베이 안쪽에서
 *    흡입구로 모여드는(제습기) 띠. 흐름 방향을 대시가 흘러가며 말한다.
 *  · **입자** — 리본 사이를 채우는 안개·열기. 세기에 비례해 개수가 는다(`lib/airEffect`).
 *  · **바닥장(場)** — 설비 앞 바닥에 퍼지는 / 모여드는 동심 파문. 기류가 닿는 **영역**이다.
 *
 * 공장 전체를 **종류당 하나의 지오메트리**로 합친다. 베이마다 따로 그리면 26면 공장에서
 * 리본·입자·바닥장이 백 콜을 넘긴다(성능 계약 — `lib/bayScene` `estimateDrawCalls`).
 * 세기는 정점 속성(`aIntensity`)에 실어 두고 폴링 때만 다시 쓴다(6초에 한 번, 만 개 정점).
 *
 * 좌표는 전부 **공장 좌표(월드)** 로 구워 둔다 — 베이 회전을 group 에 맡기면 합칠 수 없다.
 * 베이 로컬 → 공장의 회전 규약은 `ui/factoryFloor` 의 `footprintToWorld` 와 같다.
 */

/** 히터 한 대가 내는 유선 수 / 제습기 한 대가 끌어오는 유선 수 */
export const HEATER_STREAMLINES = 5
export const DRYER_STREAMLINES = 6
/** 유선 하나의 표본 수 — 24면 곡선으로 읽히고, 그 이상은 정점만 는다 */
export const STREAMLINE_SAMPLES = 24
/** 열기가 끝까지 떠오르는 높이(m) — 베이 층고(14m)의 3분의 2 */
export const HEAT_RISE_M = 9
/** 기류가 닿는 거리의 상·하한(m) — 베이가 아무리 커도 반대편 벽까지 가지는 않는다 */
export const REACH_MIN_M = 12
export const REACH_MAX_M = 34

export interface FlowUnit {
  /** `BayScene.items` 안의 순번 — 세기 갱신이 베이를 찾는 열쇠 */
  bayIndex: number
  bay: string
  id: string
  kind: '가스히터' | '제습기'
  /** 토출구(히터)·흡입구(제습기)의 공장 좌표 */
  origin: [number, number, number]
  /** 설비가 보는 방향(공장 xz, 단위) — 히터는 이쪽으로 불고 제습기는 이쪽에서 끌어온다 */
  forward: [number, number]
  /** 기류가 닿는 거리(m) */
  reach: number
}

/** 베이 로컬 [x, z] → 공장 [x, z] (`footprintToWorld` 와 같은 회전 규약) */
function toWorldXZ(item: BaySceneItem, x: number, z: number): [number, number] {
  const rad = (item.rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [item.center[0] + x * cos - z * sin, item.center[1] + x * sin + z * cos]
}

/**
 * 설비 한 대의 기류 단위 — 자리(`lib/bayStations`)와 형상의 토출점(`ui/equipmentShapes`)
 * 에서 공장 좌표의 원점·방향·닿는 거리를 만든다.
 */
export function flowUnitOf(item: BaySceneItem, bayIndex: number, station: UnitStation): FlowUnit {
  const emit = emitPointOf(station.kind)
  /* 로컬 정면(+z)을 yaw 로 돌린다 — three 의 rotation.y 와 같은 규약 (sin, cos) */
  const fx = Math.sin(station.yaw)
  const fz = Math.cos(station.yaw)
  /* 토출점은 형상 로컬(+z 가 정면)이라 yaw 로 돌려 자리에 더한다 */
  const ex = emit.x * EQUIPMENT_SYMBOL_SCALE
  const ez = emit.z * EQUIPMENT_SYMBOL_SCALE
  const localX = station.x + ex * fz + ez * fx
  const localZ = station.z - ex * fx + ez * fz
  const [wx, wz] = toWorldXZ(item, localX, localZ)
  const [dx, dz] = toWorldXZ(item, localX + fx, localZ + fz)
  const forwardX = dx - wx
  const forwardZ = dz - wz
  /* 보는 방향으로 베이가 얼마나 남았나 — 그 절반 남짓이 기류가 닿는 거리 */
  const [w, l] = item.size
  const across = Math.abs(fx) * w + Math.abs(fz) * l
  const reach = Math.max(REACH_MIN_M, Math.min(REACH_MAX_M, across * 0.55))
  return {
    bayIndex,
    bay: item.bay,
    id: station.id,
    kind: station.kind,
    origin: [wx, emit.y * EQUIPMENT_SYMBOL_SCALE, wz],
    forward: [forwardX, forwardZ],
    reach,
  }
}

/** 장면의 모든 설비를 기류 단위로 — 인덱스 순서가 곧 인스턴스·정점 블록 순서다 */
export function flowUnitsOf(items: readonly BaySceneItem[]): FlowUnit[] {
  const units: FlowUnit[] = []
  items.forEach((item, bayIndex) => {
    if (!item.air) return
    for (const station of item.stations) units.push(flowUnitOf(item, bayIndex, station))
  })
  return units
}

/** 유선 위의 한 점 — 위치와 그 자리의 띠 폭 */
export interface StreamSample {
  x: number
  y: number
  z: number
  width: number
}

/**
 * 히터 유선 — 토출구에서 **부채꼴로 퍼지며 떠오른다.**
 * t=0 이 토출구, t=1 이 닿는 끝. 더운 공기는 뜨므로 끝으로 갈수록 높고 넓다.
 */
export function heaterStreamline(unit: FlowUnit, index: number, count: number): StreamSample[] {
  const [fx, fz] = unit.forward
  const sx = -fz
  const sz = fx
  const spread = count === 1 ? 0 : ((index / (count - 1)) * 2 - 1) * 0.5 // ±0.5 rad
  const out: StreamSample[] = []
  for (let i = 0; i < STREAMLINE_SAMPLES; i += 1) {
    const t = i / (STREAMLINE_SAMPLES - 1)
    const d = t * unit.reach
    const lateral = Math.sin(spread) * d + Math.sin(t * 5 + index) * 0.4 * t
    const forwardD = Math.cos(spread) * d
    out.push({
      x: unit.origin[0] + fx * forwardD + sx * lateral,
      y: unit.origin[1] + Math.pow(t, 1.6) * HEAT_RISE_M,
      z: unit.origin[2] + fz * forwardD + sz * lateral,
      width: 0.7 + 2.2 * t,
    })
  }
  return out
}

/**
 * 제습기 유선 — 베이 안쪽 여러 높이에서 **흡입구로 모여든다.**
 * t=0 이 먼 끝, t=1 이 흡입구. 흐름은 t 가 커지는 쪽이므로 대시가 설비 쪽으로 흐른다.
 */
export function dryerStreamline(unit: FlowUnit, index: number, count: number): StreamSample[] {
  const [fx, fz] = unit.forward
  const sx = -fz
  const sz = fx
  const angle = count === 1 ? 0 : ((index / (count - 1)) * 2 - 1) * 0.7 // ±40° — 코너의 제습기는 45° 를 넘으면 벽 밖에서 시작한다
  const startHeight = 1 + (index % 3) * 2.2
  const out: StreamSample[] = []
  for (let i = 0; i < STREAMLINE_SAMPLES; i += 1) {
    const t = i / (STREAMLINE_SAMPLES - 1)
    /* 멀리서 천천히, 흡입구 앞에서 빠르게 — 거리는 (1-t)^1.4 로 준다 */
    const far = Math.pow(1 - t, 1.4) * unit.reach
    /* 곧은 직선은 배관처럼 읽힌다 — 멀리서 살짝 굽어 들어오고 흡입구 앞에서 곧아진다.
     * 굽힘은 흡입구까지의 거리에 비례하므로 유선이 베이 밖으로 나가지는 않는다 */
    const bend = angle + Math.sin(index * 1.7 + t * 3) * 0.12 * (1 - t)
    const dirX = fx * Math.cos(bend) + sx * Math.sin(bend)
    const dirZ = fz * Math.cos(bend) + sz * Math.sin(bend)
    out.push({
      x: unit.origin[0] + dirX * far,
      y: unit.origin[1] + (startHeight - unit.origin[1]) * (1 - t) * (1 - t),
      z: unit.origin[2] + dirZ * far,
      width: 1.8 - 1.2 * t,
    })
  }
  return out
}

export function streamlinesOf(unit: FlowUnit): StreamSample[][] {
  if (unit.kind === '가스히터') {
    return Array.from({ length: HEATER_STREAMLINES }, (_, i) =>
      heaterStreamline(unit, i, HEATER_STREAMLINES)
    )
  }
  return Array.from({ length: DRYER_STREAMLINES }, (_, i) =>
    dryerStreamline(unit, i, DRYER_STREAMLINES)
  )
}

/** 정점 속성의 어느 구간이 어느 설비 것인가 — 폴링 때 세기를 다시 쓰는 열쇠 */
export interface UnitRange {
  unitIndex: number
  start: number
  count: number
}

export interface RibbonGeometry {
  geometry: THREE.BufferGeometry
  ranges: UnitRange[]
}

/**
 * 한 종류의 유선 전부를 **리본 하나**로 — 각 표본을 옆으로 벌린 삼각띠.
 * 속성: `aT`(0~1 진행), `aEdge`(-1~1 가장자리), `aSeed`(리본별 위상), `aIntensity`(세기).
 */
export function buildRibbonGeometry(units: readonly FlowUnit[], kind: FlowUnit['kind']): RibbonGeometry {
  const positions: number[] = []
  const ts: number[] = []
  const edges: number[] = []
  const seeds: number[] = []
  const indices: number[] = []
  const ranges: UnitRange[] = []
  let ribbon = 0

  units.forEach((unit, unitIndex) => {
    if (unit.kind !== kind) return
    const start = positions.length / 3
    for (const line of streamlinesOf(unit)) {
      const base = positions.length / 3
      const seed = ((ribbon * 0.618) % 1)
      ribbon += 1
      for (let i = 0; i < line.length; i += 1) {
        const p = line[i]
        const next = line[Math.min(i + 1, line.length - 1)]
        const prev = line[Math.max(i - 1, 0)]
        /* 접선의 수평 수직 — 띠는 바닥과 나란히 눕는다(위에서 내려다보는 시점에 맞춰) */
        let tx = next.x - prev.x
        let tz = next.z - prev.z
        const len = Math.hypot(tx, tz) || 1
        tx /= len
        tz /= len
        const nx = -tz
        const nz = tx
        const half = p.width / 2
        positions.push(p.x + nx * half, p.y, p.z + nz * half)
        positions.push(p.x - nx * half, p.y, p.z - nz * half)
        const t = i / (line.length - 1)
        ts.push(t, t)
        edges.push(-1, 1)
        seeds.push(seed, seed)
        if (i > 0) {
          const a = base + (i - 1) * 2
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
        }
      }
    }
    const count = positions.length / 3 - start
    if (count > 0) ranges.push({ unitIndex, start, count })
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aT', new THREE.Float32BufferAttribute(ts, 1))
  geometry.setAttribute('aEdge', new THREE.Float32BufferAttribute(edges, 1))
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute(
    'aIntensity',
    new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3), 1)
  )
  geometry.setIndex(indices)
  return { geometry, ranges }
}

export interface ParticleGeometry {
  geometry: THREE.BufferGeometry
  /** 베이별 정점 블록 — 예산(그릴 개수)이 `aOn` 을 쓰는 열쇠 */
  blocks: { bayIndex: number; start: number; count: number }[]
}

/** 정점 하나에 매이는 결정적 난수 — 같은 씨앗이면 같은 그림(폴링마다 입자가 튀지 않게) */
function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/**
 * 한 종류의 입자 전부를 **Points 하나**로. 베이마다 `perBay` 개 블록을 잡고, 블록 안의
 * 정점은 그 베이의 같은 종류 설비에 돌아가며 붙는다. 움직임은 전부 셰이더가 만든다 —
 * 여기 있는 것은 원점·방향·난수뿐이다.
 */
export function buildParticleGeometry(
  units: readonly FlowUnit[],
  kind: FlowUnit['kind'],
  perBay: number
): ParticleGeometry {
  const byBay = new Map<number, FlowUnit[]>()
  for (const unit of units) {
    if (unit.kind !== kind) continue
    const bucket = byBay.get(unit.bayIndex)
    if (bucket) bucket.push(unit)
    else byBay.set(unit.bayIndex, [unit])
  }
  const bays = [...byBay.entries()].sort((a, b) => a[0] - b[0])
  const total = bays.length * perBay
  const position = new Float32Array(total * 3)
  const origin = new Float32Array(total * 3)
  const dir = new Float32Array(total * 3)
  const rand = new Float32Array(total * 4)
  const on = new Float32Array(total)
  const intensity = new Float32Array(total)
  const blocks: ParticleGeometry['blocks'] = []

  let v = 0
  for (const [bayIndex, list] of bays) {
    blocks.push({ bayIndex, start: v, count: perBay })
    for (let i = 0; i < perBay; i += 1, v += 1) {
      const unit = list[i % list.length]
      position[v * 3] = unit.origin[0]
      position[v * 3 + 1] = unit.origin[1]
      position[v * 3 + 2] = unit.origin[2]
      origin[v * 3] = unit.origin[0]
      origin[v * 3 + 1] = unit.origin[1]
      origin[v * 3 + 2] = unit.origin[2]
      dir[v * 3] = unit.forward[0] * unit.reach
      dir[v * 3 + 1] = 0
      dir[v * 3 + 2] = unit.forward[1] * unit.reach
      rand[v * 4] = hash(v + 1)
      rand[v * 4 + 1] = hash(v + 1001)
      rand[v * 4 + 2] = hash(v + 2001)
      rand[v * 4 + 3] = hash(v + 3001)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setAttribute('aOrigin', new THREE.BufferAttribute(origin, 3))
  geometry.setAttribute('aDir', new THREE.BufferAttribute(dir, 3))
  geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 4))
  geometry.setAttribute('aOn', new THREE.BufferAttribute(on, 1))
  geometry.setAttribute('aIntensity', new THREE.BufferAttribute(intensity, 1))
  return { geometry, blocks }
}

/**
 * 바닥장 인스턴스의 변환 — 설비 앞 바닥에 눕는 사각판.
 * 판 로컬은 x 가 좌우(-0.5~0.5), z 가 앞(0~1). 인스턴스가 이를 닿는 거리에 맞게 늘린다.
 */
export function floorFieldMatrix(unit: FlowUnit, target: THREE.Matrix4): THREE.Matrix4 {
  const [fx, fz] = unit.forward
  const yaw = Math.atan2(fx, fz)
  const position = new THREE.Vector3(unit.origin[0], 0.07, unit.origin[2])
  const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
  const scale = new THREE.Vector3(unit.reach * 1.4, 1, unit.reach)
  return target.compose(position, quaternion, scale)
}

/** 바닥장 판 — 앞(+z)으로 0~1, 좌우 -0.5~0.5, uv 도 그 값 */
export function floorFieldPlane(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 0, 1, -0.5, 0, 1], 3)
  )
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
  geometry.setIndex([0, 2, 1, 0, 3, 2])
  return geometry
}
