import type {
  MonitoringTagDefinition,
  RealtimeCraneLiteMessage,
} from '../model/types';
import {
  getMonitoringTagMetadataOverridesByRegion,
  type MonitoringLiveTableColumn,
  type MonitoringTagMetadataOverride,
} from '../model/region-tag-metadata';

function isValueType(value: unknown): value is string | number | null {
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
  regionId?: string,
): MonitoringLiveTableColumn[] {
  const definitionsById = new Map(
    definitions.map((definition) => [definition.tagDefinitionId, definition]),
  );
  const metadataOverridesById = regionId
    ? getMonitoringTagMetadataOverridesByRegion(regionId)
    : {};

  return tagDefinitionIds
    .map((tagDefinitionId) => definitionsById.get(tagDefinitionId))
    .filter((definition): definition is MonitoringTagDefinition =>
      Boolean(definition),
    )
    .map((definition) =>
      mergeMonitoringTagDefinition(
        definition,
        metadataOverridesById[definition.tagDefinitionId],
      ),
    );
}

function mergeMonitoringTagDefinition(
  definition: MonitoringTagDefinition,
  metadataOverride?: MonitoringTagMetadataOverride,
): MonitoringLiveTableColumn {
  if (!metadataOverride) {
    return definition;
  }

  return {
    ...definition,
    displayName: metadataOverride.displayName ?? definition.displayName,
    dataType: Object.prototype.hasOwnProperty.call(metadataOverride, 'dataType')
      ? (metadataOverride.dataType ?? null)
      : definition.dataType,
    unit: Object.prototype.hasOwnProperty.call(metadataOverride, 'unit')
      ? (metadataOverride.unit ?? null)
      : definition.unit,
    description: Object.prototype.hasOwnProperty.call(
      metadataOverride,
      'description',
    )
      ? (metadataOverride.description ?? null)
      : undefined,
  };
}
