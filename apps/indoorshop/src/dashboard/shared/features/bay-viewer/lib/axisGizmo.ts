import * as THREE from 'three'
import type { ViewDirection } from './blenderControls'

/**
 * 축 기즈모 계산.
 *
 * 뷰포트 안에서 "지금 어느 쪽에서 보고 있는가"는 점군만 봐서는 알 수 없다 —
 * 대칭인 블록을 돌리다 보면 앞뒤가 뒤집혀도 눈치채지 못한다. 그래서 CAD 도구가
 * 다 그렇듯 좌표축을 화면 구석에 세우고, 그 축을 누르면 그 방향으로 카메라가 간다.
 *
 * three.js 는 Y-up 이다 — 세로가 Y, 바닥 평면이 X-Z 다.
 */
export interface AxisEnd {
  /** `+X` `-Z` 같은 표시용 이름 */
  id: string
  label: string
  /** 기즈모 원 안에서의 위치 (-1..1, 화면 좌표계: y 아래가 +) */
  x: number
  y: number
  /** 카메라 기준 깊이 — 값이 클수록 앞쪽 (겹칠 때 앞을 위에 그린다) */
  depth: number
  /** 이 끝을 눌렀을 때 갈 시점 */
  direction: ViewDirection
  color: string
  /** 양의 방향에만 이름표를 채워 넣는다 — 여섯 개를 다 채우면 읽히지 않는다 */
  positive: boolean
}

/** X 빨강 · Y 초록 · Z 파랑 — three.js/Blender/CAD 가 공유하는 관습 */
const AXIS_COLORS = {
  x: '#e5544b',
  y: '#4aa95c',
  z: '#4c8dff',
} as const

const AXES: {
  id: string
  label: string
  vector: THREE.Vector3
  direction: ViewDirection
  color: string
  positive: boolean
}[] = [
  { id: '+x', label: 'X', vector: new THREE.Vector3(1, 0, 0), direction: 'right', color: AXIS_COLORS.x, positive: true },
  { id: '-x', label: 'X', vector: new THREE.Vector3(-1, 0, 0), direction: 'left', color: AXIS_COLORS.x, positive: false },
  { id: '+y', label: 'Y', vector: new THREE.Vector3(0, 1, 0), direction: 'top', color: AXIS_COLORS.y, positive: true },
  { id: '-y', label: 'Y', vector: new THREE.Vector3(0, -1, 0), direction: 'bottom', color: AXIS_COLORS.y, positive: false },
  { id: '+z', label: 'Z', vector: new THREE.Vector3(0, 0, 1), direction: 'front', color: AXIS_COLORS.z, positive: true },
  { id: '-z', label: 'Z', vector: new THREE.Vector3(0, 0, -1), direction: 'back', color: AXIS_COLORS.z, positive: false },
]

export interface AxisViewState {
  ends: AxisEnd[]
  /** 궤도 중심 (지금 화면이 무엇을 중심으로 도는가) */
  target: [number, number, number]
  /** 중심까지의 거리 — 줌 정도를 숫자로 보여 준다 */
  distance: number
}

const scratch = new THREE.Vector3()
const inverseQuaternion = new THREE.Quaternion()

/**
 * 카메라 자세를 기즈모 좌표로 옮긴다.
 * 원근 투영까지 흉내 내지 않는다 — 방향만 맞으면 되고, 정투영 쪽이 오히려 안정적이다.
 */
export function projectAxes(camera: THREE.Camera, target: THREE.Vector3): AxisViewState {
  inverseQuaternion.copy(camera.quaternion).invert()

  const ends = AXES.map((axis) => {
    scratch.copy(axis.vector).applyQuaternion(inverseQuaternion)
    return {
      id: axis.id,
      label: axis.label,
      x: scratch.x,
      // 화면 좌표는 아래가 + 이므로 뒤집는다
      y: -scratch.y,
      depth: -scratch.z,
      direction: axis.direction,
      color: axis.color,
      positive: axis.positive,
    }
  }).sort((a, b) => a.depth - b.depth)

  return {
    ends,
    target: [target.x, target.y, target.z],
    distance: camera.position.distanceTo(target),
  }
}
