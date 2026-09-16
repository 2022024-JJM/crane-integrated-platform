import { useMemo } from 'react';
import { create } from 'zustand';
import {
  computePlaybackStats,
  type PlaybackEvent,
  type PlaybackStats,
  type ScannedInterval,
  type StatusAggregate,
  type TagAggregate,
} from '../lib/playback-stats';
import type { PlaybackSource } from './use-playback-store';

/**
 * 플레이백 실행 통계 스토어 — 세션 전용(영속화 없음). 기록기
 * (use-playback-stats-recorder)가 재생 중 `data` 를 **제자리에서** 갱신하고
 * 4Hz 이하로 `bump()` 해 화면을 깨운다 — publish 마다 setState 를 태우면
 * 리포트 패널이 초당 수십 번 리렌더된다(tag-value-bus 와 같은 규칙).
 *
 * `reset(meta)` 가 실행(run)의 시작점이다: 새 구간 조회(loadFrames), 시나리오
 * 변경, 시뮬레이션 종료(stop), 소스 전환, 화면 진입·이탈.
 */

export interface PlaybackStatsMeta {
  source: PlaybackSource;
  regionId: string;
  /** 리플레이 구간(첫·마지막 프레임 타임스탬프). */
  replayFrom: string | null;
  replayTo: string | null;
  scenarioName: string | null;
  scenarioLoop: boolean;
  /** 실행 시작 벽시계(Date.now). */
  startedAt: number;
}

export interface PlaybackStatsData {
  meta: PlaybackStatsMeta;
  events: PlaybackEvent[];
  statuses: Record<string, StatusAggregate>;
  tags: Record<string, TagAggregate>;
  scanned: ScannedInterval[];
  windowEndMs: number;
  scenarioDurationMs: number | null;
  holdWallMs: number;
  detectionOffSeen: boolean;
  nextEventId: number;
}

export function createPlaybackStatsData(
  meta: PlaybackStatsMeta,
  scenarioDurationMs: number | null,
): PlaybackStatsData {
  return {
    meta,
    events: [],
    statuses: {},
    tags: {},
    scanned: [],
    windowEndMs: 0,
    scenarioDurationMs,
    holdWallMs: 0,
    detectionOffSeen: false,
    nextEventId: 1,
  };
}

const EMPTY_META: PlaybackStatsMeta = {
  source: 'replay',
  regionId: '',
  replayFrom: null,
  replayTo: null,
  scenarioName: null,
  scenarioLoop: false,
  startedAt: 0,
};

interface PlaybackStatsState {
  data: PlaybackStatsData;
  /** data 가 바뀌었음을 알리는 카운터 — 화면은 이것만 구독한다. */
  version: number;
  reset: (meta: PlaybackStatsMeta, scenarioDurationMs: number | null) => void;
  bump: () => void;
}

export const usePlaybackStatsStore = create<PlaybackStatsState>()(
  (set, get) => ({
    data: createPlaybackStatsData(EMPTY_META, null),
    version: 0,
    reset: (meta, scenarioDurationMs) =>
      set({
        data: createPlaybackStatsData(meta, scenarioDurationMs),
        version: get().version + 1,
      }),
    bump: () => set({ version: get().version + 1 }),
  }),
);

/** 현재 창의 리포트 — version 이 바뀔 때만 다시 집계한다. */
export function usePlaybackStats(): PlaybackStats {
  const version = usePlaybackStatsStore((s) => s.version);
  const data = usePlaybackStatsStore((s) => s.data);
  return useMemo(
    () => computePlaybackStats(data),
    // data 는 제자리 갱신이라 참조가 같다 — version 이 재집계의 키다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, version],
  );
}

export function usePlaybackStatsMeta(): PlaybackStatsMeta {
  return usePlaybackStatsStore((s) => s.data.meta);
}
