import type {
  MonitoringTagDefinition,
  RealtimeCraneLiteMessage,
} from '../model/types';

function isValueType(
  value: unknown,
): value is string | number | null {
  return (
    value === null || typeof value === 'string' || typeof value === 'number'
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

export function selectMonitoringTagDefinitions(
  definitions: MonitoringTagDefinition[],
  tagDefinitionIds: number[],
) {
  const definitionsById = new Map(
    definitions.map((definition) => [definition.tagDefinitionId, definition]),
  );

  return tagDefinitionIds
    .map((tagDefinitionId) => definitionsById.get(tagDefinitionId))
    .filter((definition): definition is MonitoringTagDefinition =>
      Boolean(definition),
    );
}
