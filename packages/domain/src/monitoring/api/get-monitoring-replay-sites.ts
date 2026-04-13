import { restClient } from '@crane/core/api';
import { getApiPath } from '@crane/core/config/network';
import type { MonitoringReplaySite } from '../model/types';

export function getMonitoringReplaySites() {
  return restClient.get<MonitoringReplaySite[]>(getApiPath('sites'));
}
