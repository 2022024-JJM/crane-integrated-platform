import type {
  ScenarioKeyframe,
  ScenarioTrack,
  VirtualScenario,
} from '../model/types';

/**
 * 시나리오 평가 — 순수 함수. 러너가 틱마다 `evaluateScenarioTrack` 을 부르고,
 * UI 미리보기·테스트가 같은 함수를 쓴다. `Math.random`·`Date.now` 없음.
 */

/** 시나리오 길이(ms) = 모든 트랙의 마지막 키프레임 시각. 트랙이 없으면 0. */
export function scenarioDurationMs(scenario: VirtualScenario): number {
  let max = 0;
  for (const track of scenario.tracks) {
    const last = track.keyframes[track.keyframes.length - 1];
    if (last && last.atMs > max) max = last.atMs;
  }
  return max;
}

/**
 * 경과 시간 → 시나리오 시각. loop 면 길이로 나눈 나머지(길이 0 은 0),
 * 아니면 길이에서 멈춘다. 음수·NaN 은 0.
 */
export function scenarioTimeMs(
  elapsedMs: number,
  durationMs: number,
  loop: boolean,
): number {
  const t = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  if (durationMs <= 0) return 0;
  if (loop) return t % durationMs;
  return Math.min(t, durationMs);
}

/** loop 가 아닌 시나리오가 끝에 닿았는지. 길이 0 은 즉시 끝. */
export function isScenarioFinished(
  elapsedMs: number,
  durationMs: number,
  loop: boolean,
): boolean {
  if (loop) return false;
  return elapsedMs >= durationMs;
}

function smoothstep(u: number): number {
  return u * u * (3 - 2 * u);
}

/**
 * 트랙 한 개의 시각 `tMs` 값. 첫 키프레임 전은 첫 값, 마지막 뒤는 마지막 값,
 * 사이는 도착 키프레임의 ease(linear 기본·hold 계단·smooth smoothstep)로
 * 보간한다. 키프레임이 없으면 undefined.
 */
export function evaluateScenarioTrack(
  track: ScenarioTrack,
  tMs: number,
): number | undefined {
  const frames = track.keyframes;
  if (frames.length === 0) return undefined;
  const t = Number.isFinite(tMs) ? tMs : 0;
  if (t <= frames[0].atMs) return frames[0].value;
  const last = frames[frames.length - 1];
  if (t >= last.atMs) return last.value;
  // frames 는 오름차순 — 도착 키프레임(t 보다 큰 첫 것)을 찾는다.
  let hi = 1;
  while (hi < frames.length && frames[hi].atMs <= t) hi += 1;
  const to = frames[hi];
  const from = frames[hi - 1];
  const span = to.atMs - from.atMs;
  if (span <= 0) return to.value;
  const ease = to.ease ?? 'linear';
  if (ease === 'hold') return from.value;
  const u = (t - from.atMs) / span;
  const w = ease === 'smooth' ? smoothstep(u) : u;
  return from.value + (to.value - from.value) * w;
}

/** 키프레임 목록을 정렬·중복 제거한 사본(첫 항목 우선). 편집 UI 가 쓴다. */
export function normalizeKeyframes(
  keyframes: readonly ScenarioKeyframe[],
): ScenarioKeyframe[] {
  const sorted = keyframes
    .filter((k) => Number.isFinite(k.atMs) && Number.isFinite(k.value))
    .slice()
    .sort((a, b) => a.atMs - b.atMs);
  const out: ScenarioKeyframe[] = [];
  for (const k of sorted) {
    if (out.length > 0 && out[out.length - 1].atMs === k.atMs) continue;
    out.push(k);
  }
  return out;
}
