import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { fitDistanceForBox } from './fitCamera'
import { dragActionOf, type DragAction } from '../../../lib/mapInteraction'

/**
 * 뷰포트 조작 — 문법의 답은 `shared/lib/mapInteraction` 한 곳이 낸다(면: `viewer`).
 *
 * 마우스:
 *  - 왼쪽 드래그    궤도 회전(orbit)   — 점군을 볼 때의 1차 동작은 돌려 보기다
 *  - 오른쪽 드래그  이동(pan)
 *  - Shift+왼쪽     이동               — 트랙패드·2버튼 마우스의 두 번째 손
 *  - Alt+왼쪽       이동
 *  - 가운데 드래그  궤도 회전 (Shift+가운데 이동, Ctrl+가운데 줌 — Blender 문법 보존)
 *  - 휠            줌
 *
 * 한때 지도와 똑같이 왼쪽=이동으로 맞췄다(UX 감사 A4). 두 화면의 손을 하나로 만들려는
 * 시도였는데, 뷰어에서는 그 배치가 손에 붙지 않는다는 피드백을 받았다 — 뷰어 계열이
 * 전부 왼쪽을 궤도 회전에 쓰기 때문이다. 지금은 면마다 1차 동작을 따르되, "오른쪽·Shift
 * 는 왼쪽의 반대 축"이라는 규칙은 두 면이 공유한다(mapInteraction 주석 참조).
 *
 * 키보드(커서가 뷰포트 위에 있을 때 — Blender 도 커서가 놓인 영역에 적용한다):
 *  - 1 / 3 / 7     정면 / 우측 / 평면. Ctrl 조합이면 반대편
 *  - 5             원근 ↔ 정투영 전환
 *  - .             선택 대상에 맞춤
 *  - Home          처음 위치로 복귀
 *
 * three.js 는 Y-up 이라 Blender(Z-up)의 축 이름을 그대로 옮기지 않고,
 * 화면에서 보이는 방향(정면/우측/평면)이 같아지도록 매핑한다.
 */

export type ViewDirection = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom'

const DIRECTIONS: Record<ViewDirection, THREE.Vector3> = {
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
  right: new THREE.Vector3(1, 0, 0),
  left: new THREE.Vector3(-1, 0, 0),
  top: new THREE.Vector3(0, 1, 0),
  bottom: new THREE.Vector3(0, -1, 0),
}

/** 동작 이름 → OrbitControls 상수 — 문법의 답은 mapInteraction 이 낸다 */
const MOUSE_OF: Record<DragAction, THREE.MOUSE> = {
  pan: THREE.MOUSE.PAN,
  rotate: THREE.MOUSE.ROTATE,
  zoom: THREE.MOUSE.DOLLY,
}

/** OrbitControls 의 마우스 버튼 배치를 뷰어 문법에 맞춘다 */
export function applyBlenderMouseBindings(controls: OrbitControls): void {
  controls.mouseButtons = {
    LEFT: MOUSE_OF[dragActionOf(0, {}, 'viewer')],
    MIDDLE: MOUSE_OF[dragActionOf(1, {}, 'viewer')],
    RIGHT: MOUSE_OF[dragActionOf(2, {}, 'viewer')],
  }
}

/**
 * 수식 키에 따라 가운데 버튼의 역할을 바꾼다.
 * OrbitControls 는 수식 키별 배치를 지원하지 않아 pointerdown 시점에 갈아끼운다.
 */
export function bindModifierAwareButtons(
  controls: OrbitControls,
  domElement: HTMLElement
): () => void {
  const handlePointerDown = (event: PointerEvent) => {
    /* 이 조합이 무슨 동작인가 — 답은 전 화면 공통 문법 하나뿐이다 */
    const action = MOUSE_OF[dragActionOf(event.button, event, 'viewer')]
    if (event.button === 1) controls.mouseButtons.MIDDLE = action
    else if (event.button === 0) controls.mouseButtons.LEFT = action
  }

  // 가운데 버튼 드래그가 브라우저의 오토스크롤로 새지 않게 막는다
  const preventAutoScroll = (event: MouseEvent) => {
    if (event.button === 1) event.preventDefault()
  }

  domElement.addEventListener('pointerdown', handlePointerDown)
  domElement.addEventListener('mousedown', preventAutoScroll)
  return () => {
    domElement.removeEventListener('pointerdown', handlePointerDown)
    domElement.removeEventListener('mousedown', preventAutoScroll)
  }
}

/** 현재 타겟까지의 거리를 유지하며 지정 방향으로 카메라를 옮긴다 */
export function setViewDirection(
  camera: THREE.Camera,
  controls: OrbitControls,
  direction: ViewDirection
): void {
  const distance = camera.position.distanceTo(controls.target)
  const offset = DIRECTIONS[direction].clone().multiplyScalar(distance)
  camera.position.copy(controls.target).add(offset)
  // 평면/저면에서는 up 벡터가 시선과 나란해져 회전이 뒤집힌다 — Z축을 위로 쓴다
  camera.up.set(0, direction === 'top' || direction === 'bottom' ? 0 : 1, direction === 'top' ? -1 : direction === 'bottom' ? 1 : 0)
  camera.lookAt(controls.target)
  controls.update()
}

/** 대상 bounding box 가 화면에 꽉 차도록 카메라를 옮긴다 */
export function frameBox(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  box: THREE.Box3,
  padding = 1.08
): void {
  if (box.isEmpty()) return

  const center = box.getCenter(new THREE.Vector3())

  // 보던 방향은 유지하고 거리만 맞춘다
  const direction = camera.position.clone().sub(controls.target)
  if (direction.lengthSq() < 1e-6) direction.set(1, 1, 1)
  direction.normalize()

  /*
   * 거리는 바운딩 **박스를 실제 화각에 투영해서** 잡는다. 가장 긴 변으로 구를
   * 잡으면 100m 홀처럼 납작하고 긴 대상이 세로 여백만 잔뜩 남긴 채 멀어진다.
   */
  const distance = Math.max(
    fitDistanceForBox(box, direction, camera.fov, camera.aspect, padding),
    1
  )

  controls.target.copy(center)
  camera.position.copy(center).addScaledVector(direction, distance)
  camera.near = Math.max(0.05, distance / 1000)
  camera.far = distance * 20
  camera.updateProjectionMatrix()
  controls.update()
}

/**
 * 화면을 처음 열었을 때의 카메라 상태.
 * 씬을 세운 직후에 한 번 떠서, Home 이 언제 눌려도 그 자리로 정확히 되돌린다.
 */
export interface HomePose {
  position: THREE.Vector3
  target: THREE.Vector3
  up: THREE.Vector3
  near: number
  far: number
}

/** 현재 카메라 상태를 처음 위치로 기억한다 */
export function captureHomePose(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls
): HomePose {
  return {
    position: camera.position.clone(),
    target: controls.target.clone(),
    up: camera.up.clone(),
    near: camera.near,
    far: camera.far,
  }
}

/**
 * 처음 위치로 되돌린다.
 *
 * bounding box 에 다시 맞추는 방식(frameBox)은 **보던 방향을 유지한 채** 거리만
 * 잡으므로, 한참 돌려본 뒤 누르면 "제자리"가 아니라 낯선 각도에서 멀어질 뿐이다.
 * 그래서 각도·거리·시선축·클리핑까지 처음 상태를 그대로 복원한다.
 */
export function resetToHome(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  home: HomePose
): void {
  camera.up.copy(home.up)
  camera.position.copy(home.position)
  controls.target.copy(home.target)
  camera.near = home.near
  camera.far = home.far
  camera.updateProjectionMatrix()
  camera.lookAt(home.target)
  controls.update()
}
