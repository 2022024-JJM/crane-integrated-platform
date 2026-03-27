import { restClient } from '@/shared/api';
import type {
  MonitoringReplayLiteQuery,
  ReplayLiteResponse,
} from '../model/types';

export function getMonitoringReplayLite(query: MonitoringReplayLiteQuery) {
  return restClient.get<ReplayLiteResponse>('monitoring/replay-lite', {
    query: {
      from: query.from,
      to: query.to,
      interval: query.interval,
    },
  });
}
