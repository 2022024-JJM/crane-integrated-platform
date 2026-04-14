import { restClient } from '@crane/core/api';
import { getApiPath } from '@crane/core/config/network';
import type { MonitoringTagDefinition } from '../model/types';

export function getMonitoringTags() {
  return restClient.get<MonitoringTagDefinition[]>(getApiPath('tags'));
}
