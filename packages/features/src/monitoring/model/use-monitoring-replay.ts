import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  getLatestReplayFrameWithValues,
  getMonitoringReplayLite,
  getReplayDefaultCraneIds,
  mapReplayResponseToRows,
} from '@crane/domain/monitoring';

interface UseMonitoringReplayParams {
  regionId: string;
  from: string;
  to: string;
  interval: string;
}

export function useMonitoringReplay({
  regionId,
  from,
  to,
  interval,
}: UseMonitoringReplayParams) {
  const craneIds = useMemo(
    () => getReplayDefaultCraneIds(regionId),
    [regionId],
  );

  const replayQuery = useQuery({
    queryKey: ['monitoring', 'replay-lite', regionId, from, to, interval],
    queryFn: () =>
      getMonitoringReplayLite({
        from,
        to,
        interval,
      }),
    enabled: Boolean(from && to && interval),
    refetchInterval: 5_000,
  });

  const rows = useMemo(() => {
    if (!replayQuery.data) {
      return [];
    }

    return mapReplayResponseToRows(replayQuery.data, craneIds);
  }, [craneIds, replayQuery.data]);

  const latestFrameTimestamp = useMemo(() => {
    if (!replayQuery.data) {
      return null;
    }

    return (
      getLatestReplayFrameWithValues(replayQuery.data, craneIds)?.timestamp ??
      null
    );
  }, [craneIds, replayQuery.data]);

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
