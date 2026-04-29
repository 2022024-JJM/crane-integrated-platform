import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getReplayFrameDurationsMs,
  getMonitoringReplayLite,
} from '@crane/domain/monitoring';
import { useReplayPlayerStore } from '../../3d/model/use-replay-player-store';

interface UseMonitoringReplayPlayerParams {
  regionId: string;
  from: string;
  to: string;
}

export function useMonitoringReplayPlayer({
  regionId,
  from,
  to,
}: UseMonitoringReplayPlayerParams) {
  const replayQuery = useQuery({
    queryKey: ['monitoring', 'replay-player', regionId, from, to],
    queryFn: () => getMonitoringReplayLite({ regionId, from, to }),
    enabled: Boolean(regionId && from && to),
    staleTime: Infinity,
  });

  const loadFrames = useReplayPlayerStore((s) => s.loadFrames);
  const frameIndex = useReplayPlayerStore((s) => s.frameIndex);
  const frames = useReplayPlayerStore((s) => s.frames);

  useEffect(() => {
    if (!replayQuery.data) {
      return;
    }

    loadFrames(
      replayQuery.data.frames,
      getReplayFrameDurationsMs(replayQuery.data.frames),
    );
  }, [replayQuery.data, loadFrames]);

  const currentTimestamp = frames[frameIndex]?.timestamp ?? null;
  const totalFrames = frames.length;

  return {
    isLoading: replayQuery.isLoading,
    isError: replayQuery.isError,
    errorMessage:
      replayQuery.error instanceof Error
        ? replayQuery.error.message
        : replayQuery.error
          ? String(replayQuery.error)
          : null,
    currentTimestamp,
    totalFrames,
    frameIndex,
  };
}
