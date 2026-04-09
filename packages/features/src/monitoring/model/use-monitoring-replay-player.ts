import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getMonitoringReplayLite,
  parseIntervalToMs,
} from '@crane/domain/monitoring';
import { useReplayPlayerStore } from '@crane/features/3d';

interface UseMonitoringReplayPlayerParams {
  regionId: string;
  from: string;
  to: string;
  interval: string;
}

/**
 * API에서 리플레이 프레임 데이터를 가져와 useReplayPlayerStore에 로드한다.
 *
 * 실시간 데이터와 달리 과거 데이터이므로 refetchInterval 없음.
 * from/to가 비어있으면 fetch하지 않는다.
 */
export function useMonitoringReplayPlayer({
  regionId: _regionId,
  from,
  to,
  interval,
}: UseMonitoringReplayPlayerParams) {
  const replayQuery = useQuery({
    queryKey: ['monitoring', 'replay-player', from, to, interval],
    queryFn: () => getMonitoringReplayLite({ from, to, interval }),
    enabled: Boolean(from && to && interval),
    staleTime: Infinity, // 과거 데이터 — 재fetch 불필요
  });

  const loadFrames = useReplayPlayerStore((s) => s.loadFrames);
  const frameIndex = useReplayPlayerStore((s) => s.frameIndex);
  const frames = useReplayPlayerStore((s) => s.frames);

  useEffect(() => {
    if (!replayQuery.data) return;
    const ms = parseIntervalToMs(replayQuery.data.interval);
    loadFrames(replayQuery.data.frames, ms);
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
