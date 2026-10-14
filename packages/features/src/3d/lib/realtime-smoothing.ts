/**
 * 실시간 값의 화면 스무딩 시간 — 키별 수신 간격에 맞춘다.
 *
 * 서버는 태그마다 일정 주기(실서버·시뮬레이터 모두 1초 스냅샷)로 값을 보낸다.
 * 값을 기본 스무딩(0.35초)으로 내보내면 0.35초 만에 목표에 닿고 다음 값까지
 * 0.65초를 서 있어 "휙 돌고 멈춤" 이 반복된다. 가상 태그 러너가 publish
 * 간격을 스무딩 시간으로 넘기는 것과 같은 규칙을 실시간에도 쓴다 — 직전
 * 값과의 간격만큼 스무딩하면 다음 값이 올 때까지 계속 움직여 1Hz 수신이
 * 연속 운동으로 보인다.
 */

/** 스무딩 하한(초) — 이보다 촘촘한 수신은 값 자체가 연속이라 짧게. */
export const REALTIME_SMOOTH_MIN_S = 0.1;
/**
 * 스무딩 상한(초) — 수신이 뜸했던(끊김·탭 숨김 복귀) 뒤 첫 값은 긴 간격을
 * 스무딩 시간으로 쓰면 수 초를 미끄러진다. 2초 넘게 비었으면 그 뒤 값은
 * 2초 안에 따라잡는다.
 */
export const REALTIME_SMOOTH_MAX_S = 2;

/**
 * 직전 publish 와의 간격(ms) → 스무딩 시간(초). 간격을 모르면(첫 값) undefined
 * = 소비자 기본. 비유한·0 이하 간격도 기본.
 */
export function resolveRealtimeSmoothTime(
  intervalMs: number | undefined,
): number | undefined {
  if (intervalMs === undefined || !Number.isFinite(intervalMs))
    return undefined;
  if (intervalMs <= 0) return undefined;
  const seconds = intervalMs / 1000;
  return Math.min(
    REALTIME_SMOOTH_MAX_S,
    Math.max(REALTIME_SMOOTH_MIN_S, seconds),
  );
}
