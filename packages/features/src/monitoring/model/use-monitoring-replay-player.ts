import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collectSceneCraneIds } from '@crane/domain/3d';
import {
  getReplayFrameDurationsMs,
  getMonitoringReplayLite,
} from '@crane/domain/monitoring';
import { useReplayPlayerStore, useSceneInfoStore } from '@crane/features/3d';

interface UseMonitoringReplayPlayerParams {
  regionId: string;
  from: string;
  to: string;
}

/**
 * 리플레이 조회·적재. 이력을 받을 크레인은 그 region 씬의 모델 craneId 다
 * (`collectSceneCraneIds`) — 씬이 아직 안 올라왔으면 빈 목록이고, 씬이 들어오면
 * 쿼리 키가 바뀌어 다시 받는다.
 */
export function useMonitoringReplayPlayer({
  regionId,
  from,
  to,
}: UseMonitoringReplayPlayerParams) {
  const sceneInfo = useSceneInfoStore((s) => s.sceneInfoByRegion[regionId]);
  const craneIds = useMemo(() => collectSceneCraneIds(sceneInfo), [sceneInfo]);
  const replayQuery = useQuery({
    queryKey: ['monitoring', 'replay-player', regionId, craneIds, from, to],
    queryFn: () => getMonitoringReplayLite({ regionId, craneIds, from, to }),
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
    /** 조회는 성공했는데 구간에 프레임이 하나도 없음. */
    isEmpty:
      replayQuery.data !== undefined && replayQuery.data.frames.length === 0,
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
