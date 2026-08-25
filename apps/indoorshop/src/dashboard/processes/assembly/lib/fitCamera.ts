import * as THREE from 'three'

/**
 * 대상을 화면 안에 다 담는 카메라 거리 계산.
 *
 * 지금까지는 "가장 긴 변 × 상수"로 거리를 잡았다. 그러면 긴 부재가 가로로 눕거나
 * 패널이 납작할 때 형상이 화면 밖으로 잘린다 — 프레임은 세로 화각만이 아니라
 * **가로 화각(= 세로 화각을 종횡비로 늘린 값)** 으로도 잘리기 때문이다.
 */

/** 세로 화각과 종횡비에서 가로 화각을 낸다 (라디안) */
function horizontalFov(fovYRad: number, aspect: number): number {
  return 2 * Math.atan(Math.tan(fovYRad / 2) * aspect)
}

/**
 * 회전해도 잘리지 않는 거리 — 바운딩 **구** 기준.
 * 자동 회전 프리뷰처럼 대상이 계속 돌아가는 경우에 쓴다.
 */
export function fitDistanceForSphere(
  radius: number,
  fovDeg: number,
  aspect: number,
  padding = 1.08
): number {
  const fovY = (fovDeg * Math.PI) / 180
  const half = Math.min(fovY, horizontalFov(fovY, aspect)) / 2
  return (radius / Math.sin(half)) * padding
}

/**
 * 고정된 시선 방향에서 딱 맞는 거리 — 바운딩 박스 8개 꼭짓점을 실제로 투영해
 * 구한다. 구 기준보다 여백이 적어 썸네일처럼 작은 그림에서 형상이 커 보인다.
 *
 * `direction` 은 대상 중심에서 카메라로 향하는 방향(정규화 전 값도 된다).
 */
export function fitDistanceForBox(
  box: THREE.Box3,
  direction: THREE.Vector3,
  fovDeg: number,
  aspect: number,
  padding = 1.06
): number {
  const fovY = (fovDeg * Math.PI) / 180
  const tanY = Math.tan(fovY / 2)
  const tanX = Math.tan(horizontalFov(fovY, aspect) / 2)

  const forward = direction.clone().normalize()
  // 카메라 기준축. 위쪽이 시선과 나란하면 up 을 바꿔 특이점을 피한다
  const worldUp = Math.abs(forward.y) > 0.99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)
  const right = new THREE.Vector3().crossVectors(worldUp, forward).normalize()
  const up = new THREE.Vector3().crossVectors(forward, right).normalize()

  const center = box.getCenter(new THREE.Vector3())
  const min = box.min
  const max = box.max
  const corner = new THREE.Vector3()
  let distance = 0

  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).sub(center)
    // 카메라 쪽으로 튀어나온 만큼(depth)은 거리를 더 벌려야 화각 안에 들어온다
    const depth = corner.dot(forward)
    distance = Math.max(
      distance,
      depth + Math.abs(corner.dot(right)) / tanX,
      depth + Math.abs(corner.dot(up)) / tanY
    )
  }

  return distance * padding
}
