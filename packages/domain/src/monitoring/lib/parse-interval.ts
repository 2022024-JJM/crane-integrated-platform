import type { ReplayLiteFrame } from '../model/types';

const DEFAULT_REPLAY_INTERVAL_MS = 5_000;

/**
 * 프레임마다 "다음 프레임까지 머무는 시간"(ms). 시각 차이가 그대로이고 못 읽는
 * 시각은 기본값이다. **마지막 프레임은 0** — 끝점이라 그 뒤가 없으므로,
 * 길이 합이 첫 프레임부터 마지막 프레임까지의 시간 폭이 된다(10분 조회면
 * 타임라인 길이도 10:00). 프레임이 하나뿐이면 폭이 없어 기본값 하나를 준다.
 */
export function getReplayFrameDurationsMs(frames: ReplayLiteFrame[]): number[] {
  if (frames.length === 0) {
    return [];
  }
  if (frames.length === 1) {
    return [DEFAULT_REPLAY_INTERVAL_MS];
  }

  const durations = new Array<number>(frames.length).fill(
    DEFAULT_REPLAY_INTERVAL_MS,
  );

  for (let index = 0; index < frames.length - 1; index += 1) {
    const currentTimestamp = Date.parse(frames[index]!.timestamp);
    const nextTimestamp = Date.parse(frames[index + 1]!.timestamp);

    if (!Number.isFinite(currentTimestamp) || !Number.isFinite(nextTimestamp)) {
      continue;
    }

    const durationMs = nextTimestamp - currentTimestamp;

    if (durationMs > 0) {
      durations[index] = durationMs;
    }
  }

  durations[frames.length - 1] = 0;

  return durations;
}
