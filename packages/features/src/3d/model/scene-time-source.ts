import { parseReplayTimestamp } from '@crane/domain/monitoring';
import { readSceneClockMs } from './use-scene-clock-store';
import { useReplayPlayerStore } from './use-replay-player-store';

/**
 * 조명이 따라갈 시각의 출처.
 * - 'clock': 씬 시계(useSceneClockStore — 실시계 또는 사용자가 고른 시각).
 *   모니터링(시뮬레이션·실시간)·에디터.
 * - 'replay': 리플레이 플레이어의 현재 프레임 타임스탬프. 프레임이 없거나
 *   타임스탬프를 못 읽으면 'clock' 으로 폴백한다.
 */
export type SceneTimeSource = 'clock' | 'replay';

/**
 * 리플레이 타임스탬프 파싱 캐시 — useFrame 에서 매 프레임 부르므로 같은
 * 문자열을 다시 파싱하지 않는다. SceneLighting 이 하나를 만들어 든다.
 */
export interface ReplayTimeCache {
  timestamp: string | null;
  timeMs: number | null;
}

export function createReplayTimeCache(): ReplayTimeCache {
  return { timestamp: null, timeMs: null };
}

/** 이 프레임의 씬 시각(UTC epoch ms). 렌더 밖(useFrame)에서 부른다. */
export function readSceneTimeMs(
  source: SceneTimeSource,
  timeZone: string,
  cache: ReplayTimeCache,
): number {
  if (source === 'replay') {
    const { frames, frameIndex } = useReplayPlayerStore.getState();
    const timestamp = frames[frameIndex]?.timestamp ?? null;
    if (timestamp !== null) {
      if (cache.timestamp !== timestamp) {
        cache.timestamp = timestamp;
        cache.timeMs = parseReplayTimestamp(timestamp, timeZone);
      }
      if (cache.timeMs !== null) return cache.timeMs;
    }
  }
  return readSceneClockMs();
}
