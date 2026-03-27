import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  buildDefaultReplayQuery,
  getLatestReplayFrame,
  getMonitoringReplayLite,
  mapReplayResponseToRows,
} from '@/entities/monitoring';

export function useMonitoringReplay(regionId: string) {
  const defaultQuery = useMemo(() => buildDefaultReplayQuery(regionId), [regionId]);

  const replayQuery = useQuery({
    queryKey: ['monitoring', 'replay-lite', regionId, defaultQuery.interval],
    queryFn: () => {
      const query = buildDefaultReplayQuery(regionId);

      return getMonitoringReplayLite({
        from: query.from,
        to: query.to,
        interval: query.interval,
      });
    },
    enabled: true,
    refetchInterval: 5_000,
  });

  const rows = useMemo(() => {
    if (!replayQuery.data) {
      return [];
    }

    return mapReplayResponseToRows(replayQuery.data, defaultQuery.craneIds);
  }, [defaultQuery.craneIds, replayQuery.data]);

  const latestFrameTimestamp = useMemo(() => {
    if (!replayQuery.data) {
      return null;
    }

    return getLatestReplayFrame(replayQuery.data)?.timestamp ?? null;
  }, [replayQuery.data]);

  return {
    rows,
    latestFrameTimestamp,
    isLoading: replayQuery.isLoading,
    isError: replayQuery.isError,
    error: replayQuery.error,
    errorMessage:
      replayQuery.error instanceof Error
        ? replayQuery.error.message
        : replayQuery.error
          ? String(replayQuery.error)
          : null,
    isEmpty: !replayQuery.isLoading && rows.length === 0,
  };
}
