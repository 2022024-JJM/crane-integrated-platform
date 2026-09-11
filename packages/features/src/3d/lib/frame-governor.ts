/**
 * 프레임 거버너의 순수 판정 — 캔버스가 초당 몇 프레임을 요청해야 하는지.
 *
 * 모니터링·리플레이 캔버스는 `frameloop='demand'` 로 두고, 이 판정이 준
 * 주기로 `invalidate()` 를 불러 프레임을 만든다(ui/scene-frame-governor.tsx).
 * 예전엔 'always' 라 화면이 안 바뀌어도 모니터 주사율(60·120Hz)로 전체
 * 씬을 다시 그렸고, 그게 유휴 발열의 가장 큰 몫이었다(2026-09-11).
 *
 * - animating: 화면을 계속 바꾸는 것이 있다 — 바다 파도, 가상 태그·실시간·
 *   리플레이 재생, 기즈모 드래그, 그리고 그것들이 멈춘 직후의 스무딩 정착
 *   유예. ANIMATING_FPS 로 돈다. 관제 화면의 크레인 움직임·파도는 30fps 면
 *   충분히 매끄럽고 GPU 일은 절반 이하가 된다.
 * - 조작(궤도 회전·팬·휠·기즈모)은 여기서 세지 않는다 — OrbitControls·표면
 *   카메라·TransformControls 가 변화 이벤트마다 스스로 invalidate 하므로
 *   이벤트 속도(= 주사율)로 그려진다. 거버너 틱과 겹치면 R3F 가 한 프레임으로
 *   합친다.
 * - slow: 화면이 정지해 있어도 아주 천천히 변하는 것(solar 모드의 태양)이
 *   있다. SLOW_FPS(5초에 한 번)로 살려 둔다.
 * - hidden: 탭이 숨겨졌으면 0 — rAF 는 어차피 멈추지만 invalidate 요청이
 *   쌓이지 않게 한다.
 *
 * ui 가 아니라 lib 에 있는 이유: 컴포넌트 파일의 함수 export 는 react-refresh
 * 규칙에 걸리고, 순수 판정이라 여기서 테스트한다.
 */

export const ANIMATING_FPS = 30;
export const SLOW_FPS = 0.2;
/**
 * 애니메이션 소스가 멈춘 뒤에도 프레임을 잇는 유예(ms) — 값 저장소 스무딩
 * (smoothTime 0.35s)이 정착하고 카메라 감쇠가 끝날 시간. 이게 없으면 재생을
 * 멈춘 순간 크레인이 목표 직전에서 얼어붙는다.
 */
export const ANIMATION_GRACE_MS = 1500;

export interface FrameGovernorInput {
  /** 지금 화면을 계속 바꾸는 소스가 있는지(유예 포함은 호출자가 판단). */
  animating: boolean;
  /** 느린 변화 소스(태양 위치)가 있는지. */
  slow: boolean;
  /** document.visibilityState === 'hidden'. */
  hidden: boolean;
}

/** 요청할 프레임 주기(fps). 0 이면 틱을 걸지 않는다. */
export function resolveGovernorFps(input: FrameGovernorInput): number {
  if (input.hidden) return 0;
  if (input.animating) return ANIMATING_FPS;
  if (input.slow) return SLOW_FPS;
  return 0;
}

/** fps → setInterval 간격(ms). 0 fps 는 null(틱 없음). */
export function governorIntervalMs(fps: number): number | null {
  if (!Number.isFinite(fps) || fps <= 0) return null;
  return Math.max(1, Math.round(1000 / fps));
}

/**
 * 유예 창 갱신 — 소스가 활성이면 지금부터 GRACE 만큼 연장, 아니면 기존 값
 * 유지. 반환값은 새 graceUntil.
 */
export function extendAnimationGrace(
  graceUntil: number,
  active: boolean,
  now: number,
  graceMs: number = ANIMATION_GRACE_MS,
): number {
  return active ? now + graceMs : graceUntil;
}
