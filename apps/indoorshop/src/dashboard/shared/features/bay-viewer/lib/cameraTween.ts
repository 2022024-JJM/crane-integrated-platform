import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/*
 * 카메라 전환 트윈 (PRD FR-4·FR-5·FR-6).
 *
 * 선택 베이 맞춤·전체 맞춤·기본 시점 복원이 하드컷으로 튀면 "지금 어디를 보고
 * 있었는지"의 문맥이 끊긴다 — 짧은 감속 이동으로 잇는다.
 * `prefers-reduced-motion` 이면 전환을 생략하고 즉시 이동한다 (FR-6).
 */

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export interface CameraPose {
  position: THREE.Vector3
  target: THREE.Vector3
}

/** ease-out cubic — 도착 직전에 감속해 "밀어 넣은" 느낌 없이 멈춘다 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * 현재 시점에서 `to` 로 부드럽게 이동한다. 반환값은 취소 함수 —
 * 도중에 새 트윈을 걸거나 사용자가 직접 조작하기 시작하면 호출부가 끊는다.
 */
export function tweenCameraTo(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  to: CameraPose,
  durationMs = 450
): () => void {
  if (durationMs <= 0 || prefersReducedMotion()) {
    camera.position.copy(to.position)
    controls.target.copy(to.target)
    controls.update()
    return () => {}
  }

  const fromPosition = camera.position.clone()
  const fromTarget = controls.target.clone()
  const start = performance.now()
  let frame = 0

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs)
    const k = easeOutCubic(t)
    camera.position.lerpVectors(fromPosition, to.position, k)
    controls.target.lerpVectors(fromTarget, to.target, k)
    controls.update()
    if (t < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)

  return () => cancelAnimationFrame(frame)
}
