import { getCraneIdsByRegion } from '../../shared';

const DEFAULT_REPLAY_INTERVAL = '5s';
const MAX_REPLAY_RANGE_MS = 60 * 60 * 1000;
const SAMPLE_REPLAY_FROM_ISO = '2024-02-01T09:00:00Z';
const SAMPLE_REPLAY_TO_ISO = '2024-02-01T10:00:00Z';

function padDateTimeSegment(value: number) {
  return String(value).padStart(2, '0');
}

function normalizeDateTimeLocalValue(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return trimmedValue;
  }

  const [datePart, timePart = '00:00:00'] = trimmedValue.split('T');
  const [hours = '00', minutes = '00', seconds = '00'] = timePart.split(':');

  return `${datePart}T${hours}:${minutes}:${seconds}`;
}

export function toIsoString(value: Date | string) {
  if (typeof value === 'string') {
    return `${normalizeDateTimeLocalValue(value)}Z`;
  }

  return value.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function toDateTimeLocalValue(value: Date | string) {
  if (typeof value === 'string') {
    return normalizeDateTimeLocalValue(
      value.replace(/\.\d{3}Z$/, 'Z').replace(/Z$/, ''),
    );
  }

  return [
    value.getFullYear(),
    padDateTimeSegment(value.getMonth() + 1),
    padDateTimeSegment(value.getDate()),
  ]
    .join('-')
    .concat(
      `T${padDateTimeSegment(value.getHours())}:${padDateTimeSegment(
        value.getMinutes(),
      )}:${padDateTimeSegment(value.getSeconds())}`,
    );
}

export function fromDateTimeLocalValue(value: string) {
  return toIsoString(value);
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
    craneIds: getReplayDefaultCraneIds(regionId),
  };
}

export function buildDefaultReplayFormValues(regionId: string) {
  const query = buildDefaultReplayQuery(regionId);

  return {
    from: toDateTimeLocalValue(query.from),
    to: toDateTimeLocalValue(query.to),
    craneIds: query.craneIds,
  };
}

export function buildSampleReplayFormValues(regionId: string) {
  return {
    from: toDateTimeLocalValue(SAMPLE_REPLAY_FROM_ISO),
    to: toDateTimeLocalValue(SAMPLE_REPLAY_TO_ISO),
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
