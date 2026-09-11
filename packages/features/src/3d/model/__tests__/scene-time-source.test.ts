import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplayLiteFrame } from '@crane/domain/monitoring';
import { createReplayTimeCache, readSceneTimeMs } from '../scene-time-source';
import { useReplayPlayerStore } from '../use-replay-player-store';
import { useSceneClockStore } from '../use-scene-clock-store';

function frame(timestamp: string): ReplayLiteFrame {
  return { timestamp, cranes: [] };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-11T03:00:00Z'));
  useSceneClockStore.setState({
    mode: 'live',
    manualTimeMs: Date.now(),
    liveNowMs: Date.now(),
  });
  useReplayPlayerStore.setState({
    frames: [],
    frameDurationsMs: [],
    frameIndex: 0,
    isPlaying: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("readSceneTimeMs — 'clock'", () => {
  it('live 면 실시계, manual 이면 고정값', () => {
    const cache = createReplayTimeCache();
    expect(readSceneTimeMs('clock', 'Asia/Seoul', cache)).toBe(Date.now());
    useSceneClockStore.getState().setManualTime(1_000_000);
    expect(readSceneTimeMs('clock', 'Asia/Seoul', cache)).toBe(1_000_000);
  });

  it('리플레이 프레임이 있어도 clock 소스는 무시한다', () => {
    useReplayPlayerStore.setState({
      frames: [frame('2026-01-01T00:00:00Z')],
      frameIndex: 0,
    });
    expect(
      readSceneTimeMs('clock', 'Asia/Seoul', createReplayTimeCache()),
    ).toBe(Date.now());
  });
});

describe("readSceneTimeMs — 'replay'", () => {
  it('현재 프레임 타임스탬프를 현장 시간대로 읽는다', () => {
    useReplayPlayerStore.setState({
      frames: [frame('2026-09-11T10:00:00'), frame('2026-09-11T10:00:05')],
      frameIndex: 1,
    });
    const cache = createReplayTimeCache();
    expect(readSceneTimeMs('replay', 'Asia/Seoul', cache)).toBe(
      Date.UTC(2026, 8, 11, 1, 0, 5),
    );
    expect(
      readSceneTimeMs('replay', 'America/New_York', createReplayTimeCache()),
    ).toBe(Date.UTC(2026, 8, 11, 14, 0, 5));
  });

  it('같은 타임스탬프는 캐시를 재사용하고, 프레임이 바뀌면 다시 파싱한다', () => {
    useReplayPlayerStore.setState({
      frames: [frame('2026-09-11T10:00:00Z'), frame('2026-09-11T10:00:05Z')],
      frameIndex: 0,
    });
    const cache = createReplayTimeCache();
    readSceneTimeMs('replay', 'Asia/Seoul', cache);
    const firstMs = cache.timeMs;
    expect(cache.timestamp).toBe('2026-09-11T10:00:00Z');
    // 캐시를 오염시켜 재파싱 여부를 본다 — 같은 프레임이면 값이 그대로.
    cache.timeMs = 42;
    expect(readSceneTimeMs('replay', 'Asia/Seoul', cache)).toBe(42);
    useReplayPlayerStore.setState({ frameIndex: 1 });
    expect(readSceneTimeMs('replay', 'Asia/Seoul', cache)).toBe(
      firstMs! + 5000,
    );
    expect(cache.timestamp).toBe('2026-09-11T10:00:05Z');
  });

  it('프레임이 없으면 씬 시계로 폴백', () => {
    expect(
      readSceneTimeMs('replay', 'Asia/Seoul', createReplayTimeCache()),
    ).toBe(Date.now());
  });

  it('타임스탬프 형식이 깨졌으면 씬 시계로 폴백 (캐시엔 null 이 남는다)', () => {
    useReplayPlayerStore.setState({
      frames: [frame('yesterday')],
      frameIndex: 0,
    });
    const cache = createReplayTimeCache();
    expect(readSceneTimeMs('replay', 'Asia/Seoul', cache)).toBe(Date.now());
    expect(cache.timestamp).toBe('yesterday');
    expect(cache.timeMs).toBeNull();
  });

  it('frameIndex 가 범위 밖이면 씬 시계로 폴백', () => {
    useReplayPlayerStore.setState({
      frames: [frame('2026-09-11T10:00:00Z')],
      frameIndex: 5,
    });
    expect(
      readSceneTimeMs('replay', 'Asia/Seoul', createReplayTimeCache()),
    ).toBe(Date.now());
  });
});
