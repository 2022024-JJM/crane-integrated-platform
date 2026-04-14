import type {
  MonitoringLiveTableCellAlign,
  MonitoringLiveTableCellKind,
  MonitoringLiveTableDisplayColumn,
  MonitoringTagDefinition,
  RealtimeCraneLiteMessage,
} from '../model/types';
import {
  getMonitoringLiveTablePreset,
  getMonitoringLiveTableTagDefinitionIds,
} from '../model/live-table-preset';
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

function inferCellKind(
  definition: MonitoringTagDefinition,
): MonitoringLiveTableCellKind {
  if (
    definition.dataType?.toUpperCase().startsWith('BIT') ||
    definition.tagCode.includes('status')
  ) {
    return 'statusDot';
  }

  if (
    definition.dataType?.toUpperCase().includes('INT') ||
    definition.dataType?.toUpperCase().includes('REAL') ||
    definition.dataType?.toUpperCase().includes('FLOAT') ||
    definition.dataType?.toUpperCase().includes('DOUBLE')
  ) {
    return 'numeric';
  }

  return 'text';
}

function inferAlign(
  cellKind: MonitoringLiveTableCellKind,
): MonitoringLiveTableCellAlign {
  if (cellKind === 'text') {
    return 'left';
  }

  return 'center';
}

export function selectMonitoringLiveTableColumns(
  definitions: MonitoringTagDefinition[],
  regionId: string,
  tagDefinitionIds?: number[],
): MonitoringLiveTableDisplayColumn[] {
  const preset = getMonitoringLiveTablePreset(regionId);
  const mergedDefinitions = selectMonitoringTagDefinitions(
    definitions,
    tagDefinitionIds?.length
      ? tagDefinitionIds
      : getMonitoringLiveTableTagDefinitionIds(regionId),
    regionId,
  );
  const groupByKey = new Map(preset.groups.map((group) => [group.key, group]));
  const presetColumnById = new Map(
    preset.columns.map((column) => [column.tagDefinitionId, column]),
  );

  return mergedDefinitions.map((definition) => {
    const presetColumn = presetColumnById.get(definition.tagDefinitionId);
    const group =
      (presetColumn && groupByKey.get(presetColumn.groupKey)) ??
      preset.groups[0] ?? {
        key: 'metrics',
        labelKey: 'common:craneStatus.table.groups.metrics',
        defaultLabel: '측정값',
      };
    const cellKind = presetColumn?.cellKind ?? inferCellKind(definition);

    return {
      ...definition,
      groupKey: group.key,
      groupLabelKey: group.labelKey,
      groupDefaultLabel: group.defaultLabel,
      headerLabelKey: presetColumn?.headerLabelKey,
      shortLabel: presetColumn?.shortLabel ?? definition.displayName,
      cellKind,
      align: presetColumn?.align ?? inferAlign(cellKind),
      statusBehavior: presetColumn?.statusBehavior,
    };
  });
}
