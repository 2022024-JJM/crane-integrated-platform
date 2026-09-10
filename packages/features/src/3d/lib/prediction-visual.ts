/**
 * 충돌 예측 표시의 수치 계산 — `ui/*.tsx` 안에서 수치 계산을 하지 않는다는
 * 규칙(AGENTS.md)의 적용점. 전부 순수 함수라 테스트 대상이다.
 */

/**
 * 고스트 불투명도. 셰이더에서 프레넬 알파에 곱해지므로 정면으로 보는 면은
 * `0.32 × 이 값`, 윤곽은 이 값까지 간다. 실물을 가리지 않고 겹쳐 읽히는
 * 농도가 목표다 — 0.85 는 너무 진해 실물과 구분이 안 됐다(2026-09-10).
 */
export const PREDICTION_GHOST_OPACITY = 0.6;
/**
 * 카운트다운 원형 호의 반지름(SVG 단위) — 둘레 계산(`countdownArc`)과 짝이라
 * 여기만 고치면 호 길이가 따라온다. 원 안에 "충돌까지" 한 줄과 숫자 한 줄이
 * 들어가야 해서 22 에서 키웠다.
 */
export const COUNTDOWN_ARC_RADIUS = 26;

/**
 * 리드타임 표시 문자열. 소수 한 자리로 **고정**한다 — 3 과 3.0 이 섞이면
 * 0.1초마다 숫자 폭이 흔들려 카운트다운이 덜컹거린다.
 */
export function formatLeadTimeSec(seconds: number): string {
  const value = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return value.toFixed(1);
}

/**
 * 카운트다운 원형 호의 `stroke-dasharray` 값 — 남은 비율만큼 채운다.
 * 처음 발견했을 때의 리드타임을 분모로 두어 "줄어드는" 것이 보이게 한다.
 */
export function countdownArc(
  leadTimeSec: number,
  initialLeadTimeSec: number,
  radius: number = COUNTDOWN_ARC_RADIUS,
): { dash: number; gap: number } {
  const circumference = 2 * Math.PI * radius;
  const denom =
    Number.isFinite(initialLeadTimeSec) && initialLeadTimeSec > 0
      ? initialLeadTimeSec
      : 1;
  const raw = Number.isFinite(leadTimeSec) ? leadTimeSec / denom : 0;
  const ratio = Math.min(1, Math.max(0, raw));
  const dash = circumference * ratio;
  return { dash, gap: circumference - dash };
}
