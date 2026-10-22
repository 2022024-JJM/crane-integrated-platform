/**
 * 리플레이 정상 전진(tick)의 화면 스무딩 시간 — 들어가는 프레임이 화면에
 * 머무는 **벽시계 시간**(프레임 길이 ÷ 배속)이다. 다음 프레임 값이 올 때
 * 정확히 닿으므로 1초 간격 이력이 연속 운동으로 보인다. 가상 태그 러너가
 * `tickMs / speed` 를 넘기는 것과 같은 규칙이고, 실시간 러너가 수신 간격을
 * 재는 것(`realtime-smoothing.ts`)의 결정론 판이다 — 리플레이는 다음 값까지의
 * 시간을 이미 안다.
 *
 * 들어가는 프레임의 길이가 0·비유한(마지막 프레임은 길이 0, 깨진 시각)이면
 * 직전 프레임 길이를, 그것도 없으면 호출자가 준 기본 길이를 쓴다 — 마지막
 * 프레임에 닿는 순간 자세가 점프하지 않게. 배속이 비정상이면 undefined
 * = 소비자 기본. seek 는 여기를 거치지 않는다(즉시 대입).
 */
export function resolveReplaySmoothTime(
  frameDurationsMs: readonly number[],
  frameIndex: number,
  speedMultiplier: number,
  fallbackDurationMs: number,
): number | undefined {
  if (!Number.isFinite(speedMultiplier) || speedMultiplier <= 0) {
    return undefined;
  }
  const durationMs = pickDuration(
    frameDurationsMs,
    frameIndex,
    fallbackDurationMs,
  );
  if (durationMs === undefined) return undefined;
  const seconds = durationMs / speedMultiplier / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

function isUsableDuration(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function pickDuration(
  frameDurationsMs: readonly number[],
  frameIndex: number,
  fallbackDurationMs: number,
): number | undefined {
  const own = frameDurationsMs[frameIndex];
  if (isUsableDuration(own)) return own;
  const previous =
    frameIndex > 0 ? frameDurationsMs[frameIndex - 1] : undefined;
  if (isUsableDuration(previous)) return previous;
  return isUsableDuration(fallbackDurationMs) ? fallbackDurationMs : undefined;
}
