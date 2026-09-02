import * as THREE from 'three'
import type { LidarBlockTransform } from '../model/lidarBlock'
import {
  BAY_WIDTH,
  BAY_HEIGHT,
  BAY_LENGTH,
  SENSOR_FOV_DEG,
  SENSOR_MAX_RANGE,
} from './bayConfig'

const HALF_FOV_TAN = Math.tan(THREE.MathUtils.degToRad(SENSOR_FOV_DEG / 2))
const WORLD_UP = new THREE.Vector3(0, 1, 0)
/** 실제 스캔처럼 보이도록 hit point에 주는 미세 노이즈(m) */
const HIT_NOISE = 0.06

/** FOV 전체를 훑는 기본 스캔 레이 수 */
const MAIN_RAY_COUNT = 6800
/** 바닥 hit의 유지 비율 — 의도적으로 낮춰 블록 대비 밀도를 줄인다 */
const BAY_SURFACE_KEEP_RATIO = 0.45
/** 이 높이보다 위의 hit(벽/천장)은 버린다 — 시각적 노이즈 제거 */
const FLOOR_HIT_MAX_Y = 0.3

/** 그림자(occlusion) 판정용 장애물 — 로컬 AABB + 배치 transform */
export interface ScanObstacle {
  min: [number, number, number]
  max: [number, number, number]
  transform: LidarBlockTransform
}

interface ResolvedObstacle {
  position: THREE.Vector3
  invQuaternion: THREE.Quaternion
  min: [number, number, number]
  max: [number, number, number]
}

function resolveObstacle(obstacle: ScanObstacle): ResolvedObstacle {
  return {
    position: new THREE.Vector3(...obstacle.transform.position),
    invQuaternion: new THREE.Quaternion(...obstacle.transform.quaternion).invert(),
    min: obstacle.min,
    max: obstacle.max,
  }
}

/** 장애물 로컬 AABB와 레이의 교차 거리 (없으면 Infinity) */
function rayObstacleDistance(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  obstacle: ResolvedObstacle,
  localOrigin: THREE.Vector3,
  localDir: THREE.Vector3
): number {
  localOrigin.copy(origin).sub(obstacle.position).applyQuaternion(obstacle.invQuaternion)
  localDir.copy(dir).applyQuaternion(obstacle.invQuaternion)

  let tMin = -Infinity
  let tMax = Infinity
  const axes: [number, number, number, number][] = [
    [localOrigin.x, localDir.x, obstacle.min[0], obstacle.max[0]],
    [localOrigin.y, localDir.y, obstacle.min[1], obstacle.max[1]],
    [localOrigin.z, localDir.z, obstacle.min[2], obstacle.max[2]],
  ]

  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return Infinity
      continue
    }
    let t1 = (lo - o) / d
    let t2 = (hi - o) / d
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
    if (tMin > tMax) return Infinity
  }

  return tMin > 0 ? tMin : Infinity
}

/**
 * 센서가 베이 내부에 있으므로, 베이 박스(바닥/천장/벽)와의 교차는 항상 "출구면"이며
 * slab 테스트의 tMax가 곧 그 거리다. 폭·길이를 받는 이유: 실형상 배치에서는 베이가
 * 30×70 상자가 아니다 — 상수 상자를 가정하면 실좌표 센서가 상자 **밖**에 서게 되어
 * tMax 가 음수가 되고, 유령 점이 베이 뒤편 수백 m 에 흩뿌려진다.
 */
function rayBayExitDistance(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  width: number,
  length: number
): number {
  let tMax = Infinity
  const axes: [number, number, number, number][] = [
    [origin.x, dir.x, -width / 2, width / 2],
    [origin.y, dir.y, 0, BAY_HEIGHT],
    [origin.z, dir.z, -length / 2, length / 2],
  ]

  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) continue
    const t1 = (lo - o) / d
    const t2 = (hi - o) / d
    tMax = Math.min(tMax, Math.max(t1, t2))
  }

  return tMax
}

/**
 * 베이 표면(바닥/벽/천장) 스캔 시뮬레이션.
 * FOV 각뿔 안으로 레이를 쏘고 베이 표면에 point를 찍되,
 * 장애물(블록 AABB)에 먼저 막히는 레이는 버려서 블록 뒤 그림자(occlusion)를 만든다.
 * 블록 표면 자체의 point는 CAD geometry 표면 샘플링(sampleSurfacePoints)이 담당한다.
 *
 * @param density 레이 수 배율 (0~1) — 공장 전체 뷰 등 다운샘플이 필요할 때 낮춘다
 */
export function simulateBaySurfaceScan(
  sensorPosition: THREE.Vector3,
  sensorTarget: THREE.Vector3,
  obstacles: ScanObstacle[],
  density = 1,
  bayWidth = BAY_WIDTH,
  bayLength = BAY_LENGTH
): Float32Array {
  const forward = sensorTarget.clone().sub(sensorPosition).normalize()
  const right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize()
  const up = new THREE.Vector3().crossVectors(right, forward).normalize()

  const resolved = obstacles.map(resolveObstacle)

  const dir = new THREE.Vector3()
  const localOrigin = new THREE.Vector3()
  const localDir = new THREE.Vector3()
  const points: number[] = []

  const rayCount = Math.round(MAIN_RAY_COUNT * density)
  for (let i = 0; i < rayCount; i++) {
    const u = (Math.random() * 2 - 1) * HALF_FOV_TAN
    const v = (Math.random() * 2 - 1) * HALF_FOV_TAN
    dir.copy(forward).addScaledVector(right, u).addScaledVector(up, v).normalize()

    const tBay = rayBayExitDistance(sensorPosition, dir, bayWidth, bayLength)
    if (!Number.isFinite(tBay) || tBay > SENSOR_MAX_RANGE) continue

    // 벽/천장 hit은 버린다 — 바닥(정반)만 남긴다
    if (sensorPosition.y + dir.y * tBay > FLOOR_HIT_MAX_Y) continue

    // 장애물에 먼저 막히면 그림자 — 표면 point 없음
    let blocked = false
    for (const obstacle of resolved) {
      if (rayObstacleDistance(sensorPosition, dir, obstacle, localOrigin, localDir) < tBay) {
        blocked = true
        break
      }
    }
    if (blocked) continue

    if (Math.random() > BAY_SURFACE_KEEP_RATIO) continue
    points.push(
      sensorPosition.x + dir.x * tBay + (Math.random() - 0.5) * HIT_NOISE,
      sensorPosition.y + dir.y * tBay + (Math.random() - 0.5) * HIT_NOISE,
      sensorPosition.z + dir.z * tBay + (Math.random() - 0.5) * HIT_NOISE
    )
  }

  return new Float32Array(points)
}
