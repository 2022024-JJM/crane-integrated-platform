import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  holdRunners,
  isRunnerRunning,
  subscribeRunnerResume,
} from '../scene-collision-hold';
import { usePlay3dStore } from '../use-play3d-store';
import { useRealtimeStore } from '../use-realtime-store';
import { useReplayPlayerStore } from '../use-replay-player-store';
import { useVirtualTagStore } from '../use-virtual-tag-store';

beforeEach(() => {
  useReplayPlayerStore.getState().reset();
  useVirtualTagStore.getState().stop();
  useRealtimeStore.getState().stop();
  usePlay3dStore.setState({ source: 'replay' });
});

describe('isRunnerRunning', () => {
  it("'play3d' 은 활성 소스의 러너를 본다", () => {
    useReplayPlayerStore.setState({ isPlaying: true });
    useVirtualTagStore.setState({ isRunning: false });
    expect(isRunnerRunning('play3d')).toBe(true);
    usePlay3dStore.setState({ source: 'simulation' });
    expect(isRunnerRunning('play3d')).toBe(false);
    useVirtualTagStore.setState({ isRunning: true });
    expect(isRunnerRunning('play3d')).toBe(true);
  });

  it("'simulation' 은 가상 태그, 'realtime' 은 WebSocket 러너", () => {
    useVirtualTagStore.setState({ isRunning: true });
    useRealtimeStore.setState({ isRunning: false });
    expect(isRunnerRunning('simulation')).toBe(true);
    expect(isRunnerRunning('realtime')).toBe(false);
  });
});

describe('holdRunners', () => {
  it('리플레이도 멈춘다(프레임 index 보존)', () => {
    useReplayPlayerStore.setState({ isPlaying: true, frameIndex: 3 });
    holdRunners();
    expect(useReplayPlayerStore.getState().isPlaying).toBe(false);
    expect(useReplayPlayerStore.getState().frameIndex).toBe(3);
    expect(useRealtimeStore.getState().held).toBe(true);
  });
});

describe('subscribeRunnerResume', () => {
  it("'play3d' 은 리플레이·가상 태그 어느 쪽의 ▶ 전이에도 부른다", () => {
    const cb = vi.fn();
    const unsub = subscribeRunnerResume('play3d', cb);
    useReplayPlayerStore.setState({ isPlaying: true });
    expect(cb).toHaveBeenCalledTimes(1);
    useReplayPlayerStore.setState({ isPlaying: true }); // 전이 아님
    expect(cb).toHaveBeenCalledTimes(1);
    useVirtualTagStore.setState({ isRunning: true });
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    useReplayPlayerStore.setState({ isPlaying: false });
    useReplayPlayerStore.setState({ isPlaying: true });
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("'simulation' 은 리플레이 전이를 무시하고, 'realtime' 은 아무것도 구독하지 않는다", () => {
    const sim = vi.fn();
    const rt = vi.fn();
    const unsubSim = subscribeRunnerResume('simulation', sim);
    const unsubRt = subscribeRunnerResume('realtime', rt);
    useReplayPlayerStore.setState({ isPlaying: true });
    expect(sim).not.toHaveBeenCalled();
    useVirtualTagStore.setState({ isRunning: true });
    expect(sim).toHaveBeenCalledTimes(1);
    useRealtimeStore.setState({ isRunning: true });
    expect(rt).not.toHaveBeenCalled();
    unsubSim();
    unsubRt();
  });
});
