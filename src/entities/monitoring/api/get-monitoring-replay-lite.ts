import { restClient } from '@/shared/api';
import { getApiPath } from '@/shared/config/network';
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
