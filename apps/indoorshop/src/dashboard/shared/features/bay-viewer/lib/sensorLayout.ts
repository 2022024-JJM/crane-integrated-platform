import * as THREE from 'three'
import { BAY_WIDTH, BAY_LENGTH, SENSOR_POLE_HEIGHT } from './bayConfig'

/*
 * three 를 쓰는 센서 배치 계산만 따로 둔다.
 * bayConfig 는 API·페이지에서도 상수를 가져가는데, 거기에 three 가 섞여 있으면
 * 3D 와 무관한 화면 번들까지 three 를 끌고 들어간다.
 */

/**
 * 센서 배치 (벽에서 1m 안쪽, 15m 기둥 위, 모두 정반 중앙을 바라봄).
 * 양쪽 장변 벽에 절반씩, 길이 방향으로 균등 분산 — 개수가 늘수록 사각이 줄어든다.
 * 4대 = 네 모서리, 6대 = 모서리 + 중앙 양측, 8대 = 장변당 4대 균등.
 * 폭·길이를 받는 이유: 실형상 배치(yard-fixture)에서는 베이마다 크기가 다르다 —
 * 실좌표(설비 엔티티)가 없는 베이의 **폴백 절차 배치**가 이 함수다.
 */
export function getSensorPositions(
  count: number,
  width = BAY_WIDTH,
  length = BAY_LENGTH
): THREE.Vector3[] {
  const insetX = width / 2 - 1
  const insetZ = length / 2 - 1
  const rows = Math.max(2, Math.ceil(count / 2))
  const positions: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const row = Math.floor(i / 2)
    const t = rows === 1 ? 0.5 : row / (rows - 1)
    positions.push(
      new THREE.Vector3(side * insetX, SENSOR_POLE_HEIGHT, -insetZ + t * 2 * insetZ)
    )
  }
  return positions
}

/** 모든 센서가 바라보는 지점(정반 중심) */
export const SENSOR_TARGET = new THREE.Vector3(0, 0, 0)
