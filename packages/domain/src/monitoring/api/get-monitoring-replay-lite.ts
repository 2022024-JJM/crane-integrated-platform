import { restClient } from '@crane/core/api';
import { getApiPath } from '@crane/core/config/network';
import type {
  MonitoringReplayLiteQuery,
  PlaybackSiteResponse,
} from '../model/types';
import { resolveMonitoringReplaySiteId } from '../lib/replay-site';
import { normalizePlaybackResponse } from '../lib/playback-adapter';
import { getMonitoringReplaySites } from './get-monitoring-replay-sites';

export async function getMonitoringReplayLite(query: MonitoringReplayLiteQuery) {
  const sites = await getMonitoringReplaySites();
  const siteId = resolveMonitoringReplaySiteId(sites, query.regionId);

  const response = await restClient.get<PlaybackSiteResponse>(
    getApiPath(`playback/sites/${siteId}`),
    {
      query: {
        from: query.from,
        to: query.to,
      },
    },
  );

  return normalizePlaybackResponse(response, query);
}
