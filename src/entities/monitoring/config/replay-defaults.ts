import { getCraneIdsByRegion } from '@/entities/crane';

const DEFAULT_REPLAY_INTERVAL = '5s';
const DEFAULT_REPLAY_LOOKBACK_MS = 3 * 60 * 1000;

function toIsoString(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function getReplayDefaultCraneIds(regionId: string) {
  return getCraneIdsByRegion(regionId);
}

export function buildDefaultReplayQuery(regionId: string) {
  const to = new Date();
  const from = new Date(to.getTime() - DEFAULT_REPLAY_LOOKBACK_MS);

  return {
    from: toIsoString(from),
    to: toIsoString(to),
    interval: DEFAULT_REPLAY_INTERVAL,
    craneIds: getReplayDefaultCraneIds(regionId),
  };
}
