import * as THREE from 'three'
import { SENSOR_FOV_DEG, SENSOR_MAX_RANGE } from './bayConfig'

const HALF_FOV_TAN = Math.tan(THREE.MathUtils.degToRad(SENSOR_FOV_DEG / 2))
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const HIT_NOISE = 0.05

/** triangle soup 표면 위 point 샘플 (위치 + 그 삼각형의 법선) */
export interface SurfaceSamples {
  positions: Float32Array
  normals: Float32Array
}

/**
 * triangle soup 표면에서 면적 가중 랜덤 샘플링.
 * 라이다가 물체 표면에서만 반사되는 특성을 표현하기 위한 기반 데이터로,
 * 이후 센서별 가시성 필터(filterSamplesForSensor)를 거쳐 PCD가 된다.
 */
export function sampleSurfacePoints(soup: Float32Array, count: number): SurfaceSamples {
  const triCount = Math.floor(soup.length / 9)
  if (triCount === 0) return { positions: new Float32Array(0), normals: new Float32Array(0) }

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const n = new THREE.Vector3()

  // 누적 면적 테이블
  const cumArea = new Float64Array(triCount)
  let total = 0
  for (let i = 0; i < triCount; i++) {
    a.fromArray(soup, i * 9)
    b.fromArray(soup, i * 9 + 3)
    c.fromArray(soup, i * 9 + 6)
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    total += n.crossVectors(ab, ac).length() / 2
    cumArea[i] = total
  }
  if (total === 0) return { positions: new Float32Array(0), normals: new Float32Array(0) }

  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)

  for (let s = 0; s < count; s++) {
    // 면적 가중 삼각형 선택 (이진 탐색)
    const r = Math.random() * total
    let lo = 0
    let hi = triCount - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cumArea[mid] < r) lo = mid + 1
      else hi = mid
    }
    const i = lo

    a.fromArray(soup, i * 9)
    b.fromArray(soup, i * 9 + 3)
    c.fromArray(soup, i * 9 + 6)

    // barycentric 균등 샘플
    let u = Math.random()
    let v = Math.random()
    if (u + v > 1) {
      u = 1 - u
      v = 1 - v
    }
    positions[s * 3] = a.x + (b.x - a.x) * u + (c.x - a.x) * v
    positions[s * 3 + 1] = a.y + (b.y - a.y) * u + (c.y - a.y) * v
    positions[s * 3 + 2] = a.z + (b.z - a.z) * u + (c.z - a.z) * v

    ab.subVectors(b, a)
    ac.subVectors(c, a)
    n.crossVectors(ab, ac).normalize()
    normals[s * 3] = n.x
    normals[s * 3 + 1] = n.y
    normals[s * 3 + 2] = n.z
  }

  return { positions, normals }
}

/** 샘플 전체에 배치 transform 적용 (위치는 matrix, 법선은 회전만) */
export function transformSamples(samples: SurfaceSamples, matrix: THREE.Matrix4): SurfaceSamples {
  const positions = new Float32Array(samples.positions.length)
  const normals = new Float32Array(samples.normals.length)
  const v = new THREE.Vector3()
  const rot = new THREE.Matrix3().setFromMatrix4(matrix)

  for (let i = 0; i < samples.positions.length; i += 3) {
    v.fromArray(samples.positions, i).applyMatrix4(matrix)
    positions[i] = v.x
    positions[i + 1] = v.y
    positions[i + 2] = v.z
    v.fromArray(samples.normals, i).applyMatrix3(rot).normalize()
    normals[i] = v.x
    normals[i + 1] = v.y
    normals[i + 2] = v.z
  }
  return { positions, normals }
}

/** 센서 가시성 필터 결과 — 위치 + 법선 + 의사 반사강도 */
export interface ScanHits {
  positions: Float32Array
  /** 히트 지점의 표면 법선 (도면↔실측 대조에서 면 방향 비교에 쓴다) */
  normals: Float32Array
  /** 의사 반사강도(0..1) — 입사각 × 거리 감쇠. 점군 명암용 */
  intensity: Float32Array
}

/**
 * 한 샘플이 센서에서 보이는지 판정한다 (대조의 "관측 가능성" 판정과 공유).
 * 조건: FOV 각뿔 내부 + 감지거리 이내 + 법선이 센서를 향함(앞면만 — 뒷면은 스캔 불가).
 *
 * @returns 보이면 입사 코사인(0..1), 안 보이면 0
 */
export function sensorVisibility(
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number,
  sensorPosition: THREE.Vector3,
  basis: SensorBasis
): number {
  const dx = px - sensorPosition.x
  const dy = py - sensorPosition.y
  const dz = pz - sensorPosition.z

  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (dist > SENSOR_MAX_RANGE || dist < 1e-6) return 0

  const { forward, right, up } = basis
  const f = (dx * forward.x + dy * forward.y + dz * forward.z) / dist
  if (f <= 0) return 0
  const r = (dx * right.x + dy * right.y + dz * right.z) / dist
  const u = (dx * up.x + dy * up.y + dz * up.z) / dist
  if (Math.abs(r / f) > HALF_FOV_TAN || Math.abs(u / f) > HALF_FOV_TAN) return 0

  const facing = -(nx * dx + ny * dy + nz * dz) / dist
  return facing < 0.03 ? 0 : facing
}

export interface SensorBasis {
  forward: THREE.Vector3
  right: THREE.Vector3
  up: THREE.Vector3
}

/** 센서 위치·타겟에서 FOV 판정용 직교 기저를 만든다 */
export function sensorBasis(
  sensorPosition: THREE.Vector3,
  sensorTarget: THREE.Vector3
): SensorBasis {
  const forward = sensorTarget.clone().sub(sensorPosition).normalize()
  const right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize()
  const up = new THREE.Vector3().crossVectors(right, forward).normalize()
  return { forward, right, up }
}

/**
 * 센서 한 대가 볼 수 있는 표면 샘플만 추출.
 * 법선과 의사 반사강도를 함께 돌려주므로, 결과를 그대로 도면↔실측 대조에 쓸 수 있다.
 */
export function filterSamplesForSensor(
  samples: SurfaceSamples,
  sensorPosition: THREE.Vector3,
  sensorTarget: THREE.Vector3
): ScanHits {
  const basis = sensorBasis(sensorPosition, sensorTarget)
  const { positions, normals } = samples

  const outPos: number[] = []
  const outNrm: number[] = []
  const outInt: number[] = []

  for (let i = 0; i < positions.length; i += 3) {
    const facing = sensorVisibility(
      positions[i],
      positions[i + 1],
      positions[i + 2],
      normals[i],
      normals[i + 1],
      normals[i + 2],
      sensorPosition,
      basis
    )
    if (facing === 0) continue

    const dx = positions[i] - sensorPosition.x
    const dy = positions[i + 1] - sensorPosition.y
    const dz = positions[i + 2] - sensorPosition.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    // 거리 감쇠 — 멀수록 어둡게. 입사각과 곱해 의사 반사강도로 쓴다.
    const falloff = 1 - Math.min(0.75, dist / SENSOR_MAX_RANGE)

    outPos.push(
      positions[i] + (Math.random() - 0.5) * HIT_NOISE,
      positions[i + 1] + (Math.random() - 0.5) * HIT_NOISE,
      positions[i + 2] + (Math.random() - 0.5) * HIT_NOISE
    )
    outNrm.push(normals[i], normals[i + 1], normals[i + 2])
    outInt.push(facing * falloff)
  }

  return {
    positions: new Float32Array(outPos),
    normals: new Float32Array(outNrm),
    intensity: new Float32Array(outInt),
  }
}
