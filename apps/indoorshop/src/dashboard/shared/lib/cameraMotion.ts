/*
 * 카메라 비행의 **리듬 단일 소스** (UX 감사 G1).
 *
 * 야드맵 700ms·easeInOutCubic, 베이 뷰어 450ms·easeOutCubic — 화면을 넘어갈 때마다
 * 리듬이 달라 "같은 야드를 다른 렌즈로 본다"는 감각이 끊겼다. 시간과 이징을 여기
 * 한 곳으로 모은다. 새 비행을 만들면 이 상수를 쓴다 — 숫자를 다시 적지 않는다.
 */

/** 드릴다운·화면 전환급 비행 — 문맥이 바뀌는 이동 */
export const CAMERA_FLY_MS = 600

/** 짧은 이동(미니맵 클릭 등) — 문맥은 그대로, 자리만 옮기는 이동 */
export const CAMERA_NUDGE_MS = 320

/** 모든 카메라 비행의 이징 — 출발·도착 양끝에서 감속한다 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** 움직임 줄이기 설정 — 참이면 비행을 생략하고 즉시 이동한다 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}
