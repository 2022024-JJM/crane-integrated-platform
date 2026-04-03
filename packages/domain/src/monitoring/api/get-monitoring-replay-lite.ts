import { restClient } from '@crane/core/api';
import { getApiPath } from '@crane/core/config/network';
import type {
  MonitoringReplayLiteQuery,
  ReplayLiteResponse,
} from '../model/types';

export function getMonitoringReplayLite(query: MonitoringReplayLiteQuery) {
  return restClient.get<ReplayLiteResponse>(
    getApiPath('monitoring/replay-lite'),
    {
    query: {
      from: query.from,
      to: query.to,
      interval: query.interval,
    },
    },
  );
}
