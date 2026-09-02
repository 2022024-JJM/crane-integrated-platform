import * as THREE from 'three'
import { sensorBasis, sensorVisibility, type SensorBasis } from './sampleSurfacePoints'
import type { ComponentSamples } from './partComponents'
import type { PartPresence } from './progressStatus'

/**
 * 도면 ↔ 실측 대조.
 *
 * 진척률을 추정하는 것이 아니다. **형태가 있으면 있는 것, 아예 없거나 전혀 다르면 미확인**이다.
 * 도면의 부재 하나하나를 실측 점군과 맞춰본다.
 *
 * 절차:
 *  1. 실측 점군을 셀 격자로 색인하고 셀마다 평균 법선을 함께 보관
 *  2. 도면 부재를 최소 표본 보장하며 샘플링 (partComponents 쪽)
 *  3. 샘플이 online 센서의 FOV·거리·앞면 조건을 만족하는지 (관측 가능성)
 *  4. 샘플 위치의 셀 ±1칸에 점이 있고 법선이 일치하면 대응
 *  5. 관측 가능한 샘플 중 대응 비율이 임계 이상이면 있음
 */

/** 공간 해시 셀 크기 (m) — 스캔 노이즈(±3cm)보다 커야 한다 */
export const MATCH_TOLERANCE = 0.05

/** 부재가 "있다"고 보는 대응 비율 */
export const PRESENT_COVERAGE = 0.4

/** 법선 일치 기준 — |cos| 이므로 판재 앞뒤를 구분하지 않는다 */
export const NORMAL_AGREEMENT = 0.6

/** 부재를 판정하기 위해 필요한 최소 관측 가능 표본 수 */
export const MIN_OBSERVABLE_SAMPLES = 4

/** 실측 점군의 공간 해시 — 셀마다 평균 법선을 함께 들고 있다 */
export interface PointIndex {
  cell: number
  /** 셀 키 → 그 셀의 누적 법선(정규화 전) */
  normals: Map<number, { x: number; y: number; z: number; n: number }>
}

const HASH_SPAN = 4096
const HASH_HALF = HASH_SPAN / 2

function cellKey(ix: number, iy: number, iz: number): number {
  // 세 축을 하나의 정수 키로 접는다 (±2048 셀 = ±102m, 베이 크기에 충분)
  return (
    ((ix + HASH_HALF) & (HASH_SPAN - 1)) * HASH_SPAN * HASH_SPAN +
    ((iy + HASH_HALF) & (HASH_SPAN - 1)) * HASH_SPAN +
    ((iz + HASH_HALF) & (HASH_SPAN - 1))
  )
}

/**
 * 실측 점군을 색인한다.
 *
 * 반드시 **블록 표면 점만** 넣는다. 바닥·지그 점을 넣으면 그 위에 겹치는 부재를
 * 있다고 오판한다.
 */
export function buildPointIndex(
  points: { positions: Float32Array; normals: Float32Array }[],
  cell = MATCH_TOLERANCE
): PointIndex {
  const normals = new Map<number, { x: number; y: number; z: number; n: number }>()

  for (const chunk of points) {
    const { positions, normals: nrm } = chunk
    for (let i = 0; i < positions.length; i += 3) {
      const ix = Math.floor(positions[i] / cell)
      const iy = Math.floor(positions[i + 1] / cell)
      const iz = Math.floor(positions[i + 2] / cell)
      const key = cellKey(ix, iy, iz)
      let entry = normals.get(key)
      if (!entry) {
        entry = { x: 0, y: 0, z: 0, n: 0 }
        normals.set(key, entry)
      }
      entry.x += nrm[i]
      entry.y += nrm[i + 1]
      entry.z += nrm[i + 2]
      entry.n++
    }
  }

  return { cell, normals }
}

/**
 * 샘플 위치 주변(±1셀)에 법선이 일치하는 점이 있는가.
 *
 * 위치만 보면 판재에 밀착해 서 있는 보강재를 구분할 수 없다 — 없는 보강재가
 * 판재의 점을 자기 것으로 인식한다. 면 방향까지 봐야 갈라진다.
 */
function hasCorrespondence(
  index: PointIndex,
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number
): boolean {
  const cx = Math.floor(px / index.cell)
  const cy = Math.floor(py / index.cell)
  const cz = Math.floor(pz / index.cell)

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const entry = index.normals.get(cellKey(cx + dx, cy + dy, cz + dz))
        if (!entry || entry.n === 0) continue
        const len = Math.hypot(entry.x, entry.y, entry.z)
        if (len < 1e-6) continue
        const cos = (entry.x * nx + entry.y * ny + entry.z * nz) / len
        if (Math.abs(cos) >= NORMAL_AGREEMENT) return true
      }
    }
  }
  return false
}

export interface MatchSensor {
  position: THREE.Vector3
  target: THREE.Vector3
}

export interface PartMatchResult {
  /** 부재별 판정 */
  presence: PartPresence[]
  /** 부재별 대응 비율 (관측 가능 표본 기준, 판정 불가면 NaN) */
  coverage: Float32Array
  /** 미확인 부재 index */
  missing: number[]
  /** 판정 불가 부재 index */
  unobservable: number[]
}

/**
 * 부재별로 도면 샘플을 실측 점군에 맞춰본다.
 *
 * @param samples 도면 부재 표면 샘플 (정반 좌표계)
 * @param partCount 부재 개수
 * @param index 실측 점군 색인
 * @param sensors online 센서 목록 — 어느 센서도 못 보는 부재는 판정하지 않는다
 */
export function matchPartsToPoints(
  samples: ComponentSamples,
  partCount: number,
  index: PointIndex,
  sensors: MatchSensor[]
): PartMatchResult {
  const observable = new Int32Array(partCount)
  const matched = new Int32Array(partCount)
  const bases: { position: THREE.Vector3; basis: SensorBasis }[] = sensors.map((s) => ({
    position: s.position,
    basis: sensorBasis(s.position, s.target),
  }))

  const { positions, normals, owners } = samples
  const sampleCount = owners.length

  for (let s = 0; s < sampleCount; s++) {
    const o = s * 3
    const px = positions[o]
    const py = positions[o + 1]
    const pz = positions[o + 2]
    const nx = normals[o]
    const ny = normals[o + 1]
    const nz = normals[o + 2]

    // 관측 가능성 — 한 대라도 볼 수 있으면 판정 대상
    let visible = false
    for (const { position, basis } of bases) {
      if (sensorVisibility(px, py, pz, nx, ny, nz, position, basis) > 0) {
        visible = true
        break
      }
    }
    if (!visible) continue

    const part = owners[s]
    observable[part]++
    if (hasCorrespondence(index, px, py, pz, nx, ny, nz)) matched[part]++
  }

  const presence: PartPresence[] = []
  const coverage = new Float32Array(partCount)
  const missing: number[] = []
  const unobservable: number[] = []

  for (let p = 0; p < partCount; p++) {
    if (observable[p] < MIN_OBSERVABLE_SAMPLES) {
      presence.push('unobservable')
      coverage[p] = NaN
      unobservable.push(p)
      continue
    }
    const ratio = matched[p] / observable[p]
    coverage[p] = ratio
    if (ratio >= PRESENT_COVERAGE) {
      presence.push('present')
    } else {
      presence.push('missing')
      missing.push(p)
    }
  }

  return { presence, coverage, missing, unobservable }
}

/**
 * 판정 정확도 — 시뮬레이션 정답(어느 부재가 실제로 만들어졌는가)과 대조한다.
 * 임계값을 만질 때마다 이 수치가 크게 움직이므로, 눈으로 보지 말고 이걸 본다.
 */
export interface MatchAccuracy {
  /** 정답상 미완인데 미확인으로 잡은 수 */
  hit: number
  /** 정답상 미완인데 있다고 본 수 */
  miss: number
  /** 정답상 완성인데 미확인으로 본 수 */
  falseAlarm: number
  /** 판정에서 제외된 수 */
  skipped: number
  recall: number
}

export function scoreMatch(
  presence: PartPresence[],
  builtParts: Set<number>
): MatchAccuracy {
  let hit = 0
  let miss = 0
  let falseAlarm = 0
  let skipped = 0

  for (let p = 0; p < presence.length; p++) {
    if (presence[p] === 'unobservable') {
      skipped++
      continue
    }
    const built = builtParts.has(p)
    if (!built && presence[p] === 'missing') hit++
    else if (!built && presence[p] === 'present') miss++
    else if (built && presence[p] === 'missing') falseAlarm++
  }

  const total = hit + miss
  return { hit, miss, falseAlarm, skipped, recall: total === 0 ? 1 : hit / total }
}
