import { restClient } from '@crane/core/api';
import { getApiPath } from '@crane/core/config/network';
import type { MonitoringTagDefinition } from '../model/types';

function isMonitoringTagDefinition(
  value: unknown,
): value is MonitoringTagDefinition {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.tagDefinitionId === 'number' &&
    typeof candidate.tagCode === 'string' &&
    typeof candidate.displayName === 'string' &&
    (typeof candidate.dataType === 'string' || candidate.dataType === null) &&
    (typeof candidate.unit === 'string' || candidate.unit === null)
  );
}

function assertMonitoringTagsResponse(
  value: unknown,
): asserts value is MonitoringTagDefinition[] {
  if (!Array.isArray(value) || !value.every(isMonitoringTagDefinition)) {
    throw new Error('Invalid monitoring tags response.');
  }
}

export async function getMonitoringTags() {
  const response = await restClient.get<unknown>(getApiPath('tags'));

  assertMonitoringTagsResponse(response);

  return response;
}
