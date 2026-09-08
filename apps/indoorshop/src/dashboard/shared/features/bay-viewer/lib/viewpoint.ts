import * as THREE from 'three'

/*
 * ── 3D 뷰어의 **기본 시점** — 세 장면이 같은 각으로 선다 ──
 *
 * 현황 탭의 설비 배치는 위에서 곧게 내려다본 도면이다. 거기서 `3D 뷰어` 로 건너가면
 * 장면이 갑자기 낮은 각(고도 29°)에서 시작해, 같은 정반을 보고 있다는 느낌이 끊겼다 —
 * 방금 읽은 도면과 지금 보는 것이 이어지지 않으면 눈이 처음부터 다시 자리를 찾는다.
 *
 * 그래서 기본 시점을 **도면에 가까운 2.5D** 로 맞춘다:
 *  · 고도 48° — 도면처럼 위에서 내려다보되, 블록의 높이(3D 로 온 이유)는 남는 각.
 *    90° 면 도면과 같아져 3D 로 온 뜻이 없고, 30° 아래면 앞줄이 뒷줄을 가린다.
 *  · 방위 22° — **오른쪽으로 약간 튼 대각**. 0° 면 정투영처럼 납작해 깊이가 안 읽히고,
 *    많이 틀면 도면에서 외운 좌우 순서가 뒤집혀 다시 이질감이 된다.
 *
 * 공장 전체·정반·실측 스캔이 **한 각을 공유**하는 것이 요점이다. 장면마다 각이 다르면
 * 탭을 옮길 때마다 새 그림이 되고, 그러면 어느 그림도 도면의 연장으로 읽히지 않는다.
 * 거리는 각 장면이 제 크기에서 계산한다 — 각만 공유하고 크기는 공유하지 않는다.
 */

/** 도면에서 이어지는 2.5D 시점 — 고도·기울임(도) */
export const PLAN_VIEWPOINT = { elevationDeg: 48, azimuthDeg: 16 } as const

/**
 * **모델 규약** — 공장 장변은 +Z 다.
 *
 * 배치 데이터가 이미 그렇게 정규화한다: `bayLayout` 의 `toLocal` 이 공장 축(베이 장변의
 * 넓이 가중 평균)을 로컬 +z 로 돌려 놓고, 실측 앵커(`realScanAnchor.displayToBayLocal`)도
 * 같은 규약을 쓴다. 그래서 카메라가 장면에서 축을 다시 알아낼 이유가 없다.
 *
 * 한때 배치에서 축을 되계산했는데, 축은 방향이 아니라 **축**이라 mod 180° 로 접히고
 * `atan2` 가 공장마다 반대쪽 대표값을 뽑았다 — 3DS 만 베이 순서가 뒤집혀 도면과 위아래가
 * 반대로 섰다. 규약을 그대로 믿으면 그 애매함 자체가 없다.
 */
export const MODEL_LONG_AXIS: readonly [number, number] = [0, 1]

/**
 * 타겟에서 카메라로 향하는 **단위 방향**.
 *
 * 방위는 +Z 에서 +X 쪽으로 잰다(three.js 의 y-up 기준). 양수면 카메라가 오른쪽으로
 * 돌아가고, 화면에서는 장면이 왼쪽으로 살짝 기울어 보인다.
 */
export function orbitDirection(
  elevationDeg: number = PLAN_VIEWPOINT.elevationDeg,
  azimuthDeg: number = PLAN_VIEWPOINT.azimuthDeg
): THREE.Vector3 {
  const elevation = THREE.MathUtils.degToRad(elevationDeg)
  const azimuth = THREE.MathUtils.degToRad(azimuthDeg)
  return new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation)
  )
}

/**
 * 공장의 장변 축을 **화면 가로로** 세우는 방위(라디안) + 약간의 오른쪽 기울임.
 *
 * 도면은 베이 장변을 가로로 눕혀 그린다(R42). 3D 가 모델 좌표 그대로 서면 같은 공장이
 * 두 그림에서 다른 각으로 누워, 탭을 옮길 때마다 새 그림이 된다. 축을 받아 그만큼 카메라를
 * 돌려 두면 두 그림의 자세가 맞고, 거기에 방위 몇 도만 더해 **도면을 살짝 오른쪽으로 튼**
 * 3D 가 된다 — 전환이 회전으로 읽히는 자리다.
 *
 * 유도: 방위 `a` 인 궤도 카메라의 화면 가로축은 세계에서 `(cos a, 0, -sin a)` 이다.
 * 축 `d=(dx, 0, dz)` 가 그와 나란하려면 `tan a = -dz/dx`.
 */
export function planAlignedAzimuth(
  axis: readonly [number, number],
  tiltDeg: number = PLAN_VIEWPOINT.azimuthDeg
): number {
  const [dx, dz] = axis
  const aligned = dx === 0 && dz === 0 ? 0 : Math.atan2(-dz, dx)
  return aligned + THREE.MathUtils.degToRad(tiltDeg)
}

/** 방위(라디안)와 고도(도)로 만든 단위 방향 — `planAlignedAzimuth` 의 짝 */
export function orbitDirectionAt(
  azimuthRad: number,
  elevationDeg: number = PLAN_VIEWPOINT.elevationDeg
): THREE.Vector3 {
  const elevation = THREE.MathUtils.degToRad(elevationDeg)
  return new THREE.Vector3(
    Math.sin(azimuthRad) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuthRad) * Math.cos(elevation)
  )
}

/**
 * 이 앱의 3D 장면이 **늘 서는 방위**(라디안).
 *
 * 도면 자세(장변이 화면 가로)에 기울임을 더한 값이다. 공장 전체·정반·실측 스캔이 모두
 * 이 값을 쓰므로, 탭을 옮기거나 정반으로 들어가도 그림이 같은 자세를 유지한다 —
 * 연속성이 각 장면의 선의가 아니라 **한 상수**에서 나온다.
 */
export const PLAN_AZIMUTH = planAlignedAzimuth(MODEL_LONG_AXIS)

/** 그 방위로 선 카메라의 단위 방향 — 장면은 거리만 제 크기에서 정한다 */
export function planViewDirection(): THREE.Vector3 {
  return orbitDirectionAt(PLAN_AZIMUTH)
}
