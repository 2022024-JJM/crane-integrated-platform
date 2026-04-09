import { getCraneIdsByRegion } from '../../shared';

const DEFAULT_REPLAY_INTERVAL = '5s';
const MAX_REPLAY_RANGE_MS = 24 * 60 * 60 * 1000;
const SAMPLE_REPLAY_FROM_ISO = '2024-02-26T10:22:00Z';
const SAMPLE_REPLAY_TO_ISO = '2024-02-26T10:25:00Z';

function padDateTimeSegment(value: number) {
  return String(value).padStart(2, '0');
}

export function toIsoString(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function toDateTimeLocalValue(date: Date) {
  return [
    date.getFullYear(),
    padDateTimeSegment(date.getMonth() + 1),
    padDateTimeSegment(date.getDate()),
  ]
    .join('-')
    .concat(
      `T${padDateTimeSegment(date.getHours())}:${padDateTimeSegment(
        date.getMinutes(),
      )}:${padDateTimeSegment(date.getSeconds())}`,
    );
}

export function fromDateTimeLocalValue(value: string) {
  return toIsoString(new Date(value));
}

export function getReplayDefaultCraneIds(regionId: string) {
  return getCraneIdsByRegion(regionId);
}

export function getDefaultReplayInterval() {
  return DEFAULT_REPLAY_INTERVAL;
}

export function buildDefaultReplayQuery(regionId: string) {
  return {
    from: SAMPLE_REPLAY_FROM_ISO,
    to: SAMPLE_REPLAY_TO_ISO,
    interval: DEFAULT_REPLAY_INTERVAL,
    craneIds: getReplayDefaultCraneIds(regionId),
  };
}

export function buildDefaultReplayFormValues(regionId: string) {
  const query = buildDefaultReplayQuery(regionId);

  return {
    from: toDateTimeLocalValue(new Date(query.from)),
    to: toDateTimeLocalValue(new Date(query.to)),
    interval: query.interval,
    craneIds: query.craneIds,
  };
}

export function buildSampleReplayFormValues(regionId: string) {
  return {
    from: toDateTimeLocalValue(new Date(SAMPLE_REPLAY_FROM_ISO)),
    to: toDateTimeLocalValue(new Date(SAMPLE_REPLAY_TO_ISO)),
    interval: DEFAULT_REPLAY_INTERVAL,
    craneIds: getReplayDefaultCraneIds(regionId),
  };
}

export function validateReplayDateTimeRange(from: string, to: string) {
  if (!from || !to) {
    return { isValid: false, reason: 'missing' as const };
  }

  const parsedFrom = new Date(from);
  const parsedTo = new Date(to);

  if (Number.isNaN(parsedFrom.getTime()) || Number.isNaN(parsedTo.getTime())) {
    return { isValid: false, reason: 'invalid' as const };
  }

  if (parsedFrom > parsedTo) {
    return { isValid: false, reason: 'order' as const };
  }

  if (parsedTo.getTime() - parsedFrom.getTime() > MAX_REPLAY_RANGE_MS) {
    return { isValid: false, reason: 'tooLarge' as const };
  }

  return { isValid: true, reason: null };
}
