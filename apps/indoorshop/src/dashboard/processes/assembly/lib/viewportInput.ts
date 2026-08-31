import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/*
 * 뷰포트 조작 포커스와 페이지 스크롤 연계 (PRD FR-6).
 *
 * 문제: 휠은 페이지 스크롤과 3D 줌이 같은 입력을 두고 다툰다. 뷰포트가 항상 휠을
 * 삼키면 페이지 중간의 3D 상자 위에서 스크롤이 "걸려" 내려가지 못한다.
 *
 * 규칙:
 *  - 처음에는 휠을 소비하지 않는다 — 스크롤은 페이지 것이다.
 *  - 뷰포트를 클릭(드래그 시작)하는 순간 조작 포커스를 얻고 휠 줌이 켜진다.
 *  - 포커스 상태에서도 줌 한계(min/maxDistance)에 닿은 방향의 휠은 소비하지 않아
 *    페이지 스크롤로 자연스럽게 이어진다.
 *  - Esc 또는 뷰포트 밖 클릭으로 포커스를 해제한다.
 *
 * 드래그(회전·이동)는 페이지 스크롤과 충돌하지 않으므로 게이트하지 않는다.
 */

export interface ViewportFocusOptions {
  onFocusChange?: (focused: boolean) => void
  onBlockedWheel?: () => void
}

export interface ViewportFocusApi {
  isFocused: () => boolean
  /** 포커스를 코드에서 해제한다 (Esc 처리 등) */
  blur: () => void
  dispose: () => void
}

export function bindViewportFocus(
  controls: OrbitControls,
  camera: THREE.PerspectiveCamera,
  container: HTMLElement,
  options: ViewportFocusOptions = {}
): ViewportFocusApi {
  let focused = false
  let restoreZoomTimer = 0

  const setFocused = (next: boolean) => {
    if (focused === next) return
    focused = next
    controls.enableZoom = next
    options.onFocusChange?.(next)
  }

  // 시작은 페이지 스크롤 우선 — 휠을 소비하지 않는다
  controls.enableZoom = false

  const handlePointerDownInside = () => setFocused(true)

  /** 뷰포트 밖 어디든 누르면 포커스 해제 (캡처 단계 — 다른 위젯이 stopPropagation 해도 듣는다) */
  const handleDocumentPointerDown = (event: PointerEvent) => {
    if (!container.contains(event.target as Node)) setFocused(false)
  }

  /**
   * 휠 캡처 — OrbitControls 의 휠 리스너(캔버스에 걸림)보다 조상(container)의 캡처
   * 단계가 먼저 돈다. 여기서 enableZoom 을 끄면 그 이벤트는 preventDefault 되지 않아
   * 브라우저가 페이지를 스크롤한다.
   */
  const handleWheelCapture = (event: WheelEvent) => {
    if (!focused) {
      options.onBlockedWheel?.()
      return
    }
    const distance = camera.position.distanceTo(controls.target)
    const zoomingOut = event.deltaY > 0
    const epsilon = Math.max(0.05, distance * 0.002)
    const atLimit = zoomingOut
      ? distance >= controls.maxDistance - epsilon
      : distance <= controls.minDistance + epsilon
    if (atLimit) {
      controls.enableZoom = false
      window.clearTimeout(restoreZoomTimer)
      restoreZoomTimer = window.setTimeout(() => {
        if (focused) controls.enableZoom = true
      }, 0)
    }
  }

  container.addEventListener('pointerdown', handlePointerDownInside)
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  container.addEventListener('wheel', handleWheelCapture, { capture: true, passive: true })

  return {
    isFocused: () => focused,
    blur: () => setFocused(false),
    dispose: () => {
      window.clearTimeout(restoreZoomTimer)
      container.removeEventListener('pointerdown', handlePointerDownInside)
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
      container.removeEventListener('wheel', handleWheelCapture, { capture: true })
    },
  }
}

/**
 * 카메라 이동 가능 범위 제한 (FR-6) — 타겟이 공장 경계를 벗어나면 장면을 잃는다.
 * OrbitControls 'change' 마다 타겟을 경계 안으로 되밀고, 카메라도 같은 양만큼
 * 옮겨 화면이 튀지 않게 한다. 반환값은 해제 함수.
 */
export function clampPanToBounds(
  controls: OrbitControls,
  camera: THREE.PerspectiveCamera,
  bounds: THREE.Box3,
  margin = 20
): () => void {
  const clamped = new THREE.Vector3()
  const handleChange = () => {
    clamped.copy(controls.target)
    clamped.x = THREE.MathUtils.clamp(clamped.x, bounds.min.x - margin, bounds.max.x + margin)
    clamped.z = THREE.MathUtils.clamp(clamped.z, bounds.min.z - margin, bounds.max.z + margin)
    clamped.y = THREE.MathUtils.clamp(clamped.y, bounds.min.y, bounds.max.y + margin)
    if (!clamped.equals(controls.target)) {
      camera.position.add(clamped).sub(controls.target)
      controls.target.copy(clamped)
    }
  }
  controls.addEventListener('change', handleChange)
  return () => controls.removeEventListener('change', handleChange)
}
