/**
 * 리플레이 프레임 index ↔ 누적 ms 변환. 프레임마다 길이가 다를 수 있어
 * (`frameDurationsMs`) 단순 곱셈이 아니다. 트랜스포트 어댑터(seek·위치 표시)
 * 와 통계의 시간 축이 같은 함수를 쓴다.
 */

/** index 프레임의 시작 시각(ms) — 앞 프레임 길이의 합. 범위 밖 index 는 clamp. */
export function cumulativeMs(
  durations: readonly number[],
  upToIndex: number,
): number {
  const end = Math.min(Math.max(0, upToIndex), durations.length);
  let sum = 0;
  for (let i = 0; i < end; i += 1) sum += Math.max(0, durations[i] ?? 0);
  return sum;
}

/** 전체 길이(ms). */
export function totalMs(durations: readonly number[]): number {
  return cumulativeMs(durations, durations.length);
}

/**
 * ms 시각이 속한 프레임 index — 시작 시각이 ms 이하인 마지막 프레임.
 * 음수·NaN 은 0, 끝을 넘으면 마지막 프레임. 프레임이 없으면 0.
 */
export function frameIndexAtMs(
  durations: readonly number[],
  ms: number,
): number {
  if (durations.length === 0) return 0;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  let acc = 0;
  for (let i = 0; i < durations.length; i += 1) {
    acc += Math.max(0, durations[i] ?? 0);
    if (ms < acc) return i;
  }
  return durations.length - 1;
}
