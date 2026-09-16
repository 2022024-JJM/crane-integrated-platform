import { useMemo } from 'react';
import {
  SIMULATION_SPEED_OPTIONS,
  scenarioDurationMs,
} from '@crane/domain/virtual-tag';
import { cumulativeMs, frameIndexAtMs, totalMs } from '../lib/replay-position';
import { usePlaybackStore, type PlaybackSource } from './use-playback-store';
import { useReplayPlayerStore } from './use-replay-player-store';
import { useSceneCollisionStore } from './use-scene-collision-store';
import { useVirtualTagStore } from './use-virtual-tag-store';
import { virtualTagRuntime } from './virtual-tag-runner';

/**
 * 플레이백 트랜스포트 어댑터 — 리플레이 스토어와 가상 태그 스토어 위에 같은
 * 인터페이스를 씌운다. 하단 트랜스포트 바·사건 마커 seek·통계 기록기가 전부
 * 이것만 보고, 소스별 분기는 여기 한 곳에 있다.
 *
 * 시간 축은 씬 시간(ms)이다 — 리플레이는 프레임 누적 ms(lib/replay-position),
 * 시뮬레이션은 러너 경과 ms(배속 무관). 위치는 프레임 속도로 바뀌는 mutable
 * 값이라 React 상태로 올리지 않는다 — `readPlaybackPositionMs()` 를 폴링으로
 * 읽는다(rig-live-readouts 규칙). 훅은 재생 여부·배속·길이만 구독한다.
 */

/** 리플레이 배속 선택지 — 옛 ReplayPlayerControls 와 같다. */
export const REPLAY_SPEED_OPTIONS: readonly number[] = [0.5, 1, 2, 4, 8];

export interface PlaybackTransport {
  source: PlaybackSource;
  isPlaying: boolean;
  /** 전체 길이(ms). 시뮬레이션에 활성 시나리오가 없으면 null(열린 구간). */
  durationMs: number | null;
  /** 재생할 것이 있는지 — 리플레이는 프레임 존재, 시뮬레이션은 항상 true. */
  hasContent: boolean;
  speed: number;
  speedOptions: readonly number[];
  play: () => void;
  pause: () => void;
  /** 씬 시간(ms)으로 이동. 리플레이는 가장 가까운 프레임으로 내린다. */
  seek: (ms: number) => void;
  /** 프레임 단위 이동(리플레이 전용, 시뮬레이션은 no-op). */
  stepFrames: (delta: number) => void;
  setSpeed: (speed: number) => void;
}

/** 현재 씬 시간(ms) — 폴링으로 읽는다. */
export function readPlaybackPositionMs(
  source: PlaybackSource = usePlaybackStore.getState().source,
): number {
  if (source === 'replay') {
    const { frameDurationsMs, frameIndex } = useReplayPlayerStore.getState();
    return cumulativeMs(frameDurationsMs, frameIndex);
  }
  return virtualTagRuntime.elapsed;
}

/** 리플레이 현재 프레임 index(시뮬레이션은 null) — 통계가 사건에 함께 적는다. */
export function readPlaybackFrameIndex(
  source: PlaybackSource = usePlaybackStore.getState().source,
): number | null {
  if (source !== 'replay') return null;
  return useReplayPlayerStore.getState().frameIndex;
}

function seekReplay(ms: number): void {
  const store = useReplayPlayerStore.getState();
  store.seekTo(frameIndexAtMs(store.frameDurationsMs, ms));
  // seek 뒤 자세가 바뀌는데 pinned 박스가 옛 자세를 가리키면 안 된다 —
  // 정지 상태만 풀고(실시간 보류 해제 포함) 기록은 남긴다. 스캔 재개는
  // ▶ 전이의 재기준선이 맡는다.
  useSceneCollisionStore.getState().clearActive();
}

function seekSimulation(ms: number): void {
  useVirtualTagStore.getState().seek(ms);
  useSceneCollisionStore.getState().clearActive();
}

/** 활성 소스의 어댑터 스냅샷 — 렌더 밖(구독 콜백·useFrame)에서 부른다. */
export function readPlaybackTransport(): PlaybackTransport {
  const source = usePlaybackStore.getState().source;
  if (source === 'replay') {
    const replay = useReplayPlayerStore.getState();
    return {
      source,
      isPlaying: replay.isPlaying,
      durationMs: totalMs(replay.frameDurationsMs),
      hasContent: replay.frames.length > 0,
      speed: replay.speedMultiplier,
      speedOptions: REPLAY_SPEED_OPTIONS,
      play: replay.play,
      pause: replay.pause,
      seek: seekReplay,
      stepFrames: replay.seekByFrames,
      setSpeed: replay.setSpeed,
    };
  }
  const sim = useVirtualTagStore.getState();
  const scenario = sim.scenarios.find((s) => s.id === sim.activeScenarioId);
  return {
    source,
    isPlaying: sim.isRunning,
    durationMs: scenario ? scenarioDurationMs(scenario) : null,
    hasContent: true,
    speed: sim.speed,
    speedOptions: SIMULATION_SPEED_OPTIONS,
    play: () => {
      void sim.load();
      sim.start();
    },
    pause: sim.pause,
    seek: seekSimulation,
    stepFrames: () => {},
    setSpeed: sim.setSpeed,
  };
}

/**
 * 트랜스포트 훅 — 재생 여부·배속·길이·소스가 바뀔 때만 리렌더한다. 위치는
 * 포함하지 않는다(readPlaybackPositionMs 를 폴링).
 */
export function usePlaybackTransport(): PlaybackTransport {
  const source = usePlaybackStore((s) => s.source);
  const replayPlaying = useReplayPlayerStore((s) => s.isPlaying);
  const replaySpeed = useReplayPlayerStore((s) => s.speedMultiplier);
  const replayDurations = useReplayPlayerStore((s) => s.frameDurationsMs);
  const simRunning = useVirtualTagStore((s) => s.isRunning);
  const simSpeed = useVirtualTagStore((s) => s.speed);
  const scenarios = useVirtualTagStore((s) => s.scenarios);
  const activeScenarioId = useVirtualTagStore((s) => s.activeScenarioId);
  return useMemo(
    () => readPlaybackTransport(),
    // 스냅샷은 스토어에서 직접 읽는다 — 아래 값들은 "언제 다시 읽을지" 의 키다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      source,
      replayPlaying,
      replaySpeed,
      replayDurations,
      simRunning,
      simSpeed,
      scenarios,
      activeScenarioId,
    ],
  );
}
