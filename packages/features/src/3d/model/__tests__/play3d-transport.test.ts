import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplayLiteFrame } from '@crane/domain/monitoring';
import { readPlay3dTransport } from '../play3d-transport';
import { rigValueStore } from '../rig-value-store';
import { stopSimulation } from '../stop-simulation';
import { setTagIngest, tagLiveValues } from '../tag-value-bus';
import { usePlay3dStore } from '../use-play3d-store';
import { useReplayPlayerStore } from '../use-replay-player-store';

// 시뮬레이션 종료의 본체(시나리오 스토어 stop·충돌 기록 삭제)는 자기 테스트가
// 있다 — 여기서는 어댑터가 소스에 맞는 정리를 부르는지만 본다.
vi.mock('../stop-simulation', () => ({ stopSimulation: vi.fn() }));

function frame(x: number): ReplayLiteFrame {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    cranes: [
      { craneId: 'GC_04', craneNo: '4', snapshotAt: null, values: { X: x } },
    ],
  };
}

const received = new Map<string, number>();

beforeEach(() => {
  vi.mocked(stopSimulation).mockClear();
  useReplayPlayerStore.setState({
    frames: [],
    frameDurationsMs: [],
    frameIndex: 0,
    isPlaying: false,
    speedMultiplier: 1,
  });
  usePlay3dStore.setState({ source: 'replay' });
  received.clear();
  tagLiveValues.clear();
  rigValueStore.reset();
  setTagIngest((key, value) => received.set(key, value));
});

afterEach(() => {
  setTagIngest(null);
});

describe('Play3dTransport.stop — 리플레이', () => {
  it('재생 중이면 멈추고 첫 프레임으로 — 불러온 프레임은 남는다', () => {
    const frames = [frame(10), frame(20), frame(30)];
    useReplayPlayerStore.setState({
      frames,
      frameDurationsMs: [1000, 1000, 1000],
      frameIndex: 2,
      isPlaying: true,
    });

    readPlay3dTransport().stop();

    const replay = useReplayPlayerStore.getState();
    expect(replay.isPlaying).toBe(false);
    expect(replay.frameIndex).toBe(0);
    expect(replay.frames).toBe(frames);
    expect(received.get('GC_04.X')).toBe(10);
    expect(stopSimulation).not.toHaveBeenCalled();
  });

  it('이미 처음에서 멈춰 있어도 같은 상태로 남는다', () => {
    useReplayPlayerStore.setState({
      frames: [frame(10), frame(20)],
      frameDurationsMs: [1000, 1000],
    });

    readPlay3dTransport().stop();

    const replay = useReplayPlayerStore.getState();
    expect(replay.isPlaying).toBe(false);
    expect(replay.frameIndex).toBe(0);
  });

  it('프레임이 없으면 재생만 끄고 아무 값도 내보내지 않는다', () => {
    useReplayPlayerStore.setState({ isPlaying: true });

    expect(() => readPlay3dTransport().stop()).not.toThrow();

    const replay = useReplayPlayerStore.getState();
    expect(replay.isPlaying).toBe(false);
    expect(replay.frameIndex).toBe(0);
    expect(received.size).toBe(0);
  });
});

describe('Play3dTransport.stop — 시뮬레이션', () => {
  it('stopSimulation 을 한 번 부르고 리플레이 상태는 건드리지 않는다', () => {
    useReplayPlayerStore.setState({
      frames: [frame(10), frame(20)],
      frameDurationsMs: [1000, 1000],
      frameIndex: 1,
      isPlaying: true,
    });
    usePlay3dStore.setState({ source: 'simulation' });

    readPlay3dTransport().stop();

    expect(stopSimulation).toHaveBeenCalledTimes(1);
    const replay = useReplayPlayerStore.getState();
    expect(replay.frameIndex).toBe(1);
    expect(replay.isPlaying).toBe(true);
  });
});
