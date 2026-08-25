import * as THREE from 'three'
import { BAY_WIDTH, BAY_LENGTH, SENSOR_POLE_HEIGHT } from './bayConfig'

/*
 * three 를 쓰는 센서 배치 계산만 따로 둔다.
 * bayConfig 는 API·페이지에서도 상수를 가져가는데, 거기에 three 가 섞여 있으면
 * 3D 와 무관한 화면 번들까지 three 를 끌고 들어간다.
 */

const INSET_X = BAY_WIDTH / 2 - 1
const INSET_Z = BAY_LENGTH / 2 - 1

/**
 * 센서 배치 (벽에서 1m 안쪽, 15m 기둥 위, 모두 정반 중앙을 바라봄).
 * 양쪽 장변 벽에 절반씩, 길이 방향으로 균등 분산 — 개수가 늘수록 사각이 줄어든다.
 * 4대 = 네 모서리, 6대 = 모서리 + 중앙 양측, 8대 = 장변당 4대 균등.
 */
export function getSensorPositions(count: number): THREE.Vector3[] {
  const rows = Math.max(2, Math.ceil(count / 2))
  const positions: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const row = Math.floor(i / 2)
    const t = rows === 1 ? 0.5 : row / (rows - 1)
    positions.push(
      new THREE.Vector3(side * INSET_X, SENSOR_POLE_HEIGHT, -INSET_Z + t * 2 * INSET_Z)
    )
  }
  return positions
}

/** 모든 센서가 바라보는 지점(정반 중심) */
export const SENSOR_TARGET = new THREE.Vector3(0, 0, 0)
