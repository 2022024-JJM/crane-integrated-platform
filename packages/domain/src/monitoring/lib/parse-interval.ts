import type { ReplayLiteFrame } from '../model/types';

const DEFAULT_REPLAY_INTERVAL_MS = 5_000;

function toTimestampMs(value: string) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getReplayFrameDurationsMs(
  frames: ReplayLiteFrame[],
): number[] {
  if (frames.length === 0) {
    return [];
  }

  const durations = new Array<number>(frames.length).fill(
    DEFAULT_REPLAY_INTERVAL_MS,
  );

  for (let index = 0; index < frames.length - 1; index += 1) {
    const currentTimestamp = toTimestampMs(frames[index]!.timestamp);
    const nextTimestamp = toTimestampMs(frames[index + 1]!.timestamp);

    if (currentTimestamp === null || nextTimestamp === null) {
      continue;
    }

    const durationMs = nextTimestamp - currentTimestamp;

    if (durationMs > 0) {
      durations[index] = durationMs;
    }
  }

  if (frames.length > 1) {
    durations[frames.length - 1] =
      durations[frames.length - 2] ?? DEFAULT_REPLAY_INTERVAL_MS;
  }

  return durations;
}
