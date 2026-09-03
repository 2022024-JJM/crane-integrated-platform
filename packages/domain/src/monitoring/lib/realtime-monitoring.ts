import type {
  MonitoringLiveValue,
  RealtimeCraneLiteMessage,
} from '../model/types';

function isValueType(value: unknown): value is MonitoringLiveValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

export function isRealtimeCraneLiteMessage(
  value: unknown,
): value is RealtimeCraneLiteMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.eventType === 'snapshot.delta' &&
    typeof candidate.craneId === 'string' &&
    typeof candidate.tagCode === 'string' &&
    isValueType(candidate.value) &&
    typeof candidate.timestamp === 'string' &&
    typeof candidate.quality === 'number' &&
    typeof candidate.changed === 'boolean' &&
    typeof candidate.occurredAt === 'string'
  );
}
