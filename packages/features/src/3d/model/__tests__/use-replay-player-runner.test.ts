// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReplayLiteFrame } from '@crane/domain/monitoring';
import { useReplayPlayerRunner } from '../use-replay-player-runner';
import { useReplayPlayerStore } from '../use-replay-player-store';

/**
 * R3F의 프레임 루프를 직접 돌릴 수 없으므로 useFrame을 가로채 콜백을 잡아
 * 두고, delta(초)를 수동 주입해 시간을 결정론적으로 진행시킨다 —
 * 실타이머/requestAnimationFrame에 기대지 않아 flaky하지 않다.
 */
const captured = vi.hoisted(() => ({
  frameCallback: null as
    | null
    | ((state: unknown, delta: number) => void),
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    captured.frameCallback = callback;
  },
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function frame(): ReplayLiteFrame {
  return { timestamp: 't', cranes: [] };
}

function step(deltaSeconds: number) {
  act(() => {
    captured.frameCallback?.(undefined, deltaSeconds);
  });
}

function store() {
  return useReplayPlayerStore.getState();
}

beforeEach(() => {
  useReplayPlayerStore.setState({
    frames: [],
    frameDurationsMs: [],
    frameIndex: 0,
    isPlaying: false,
    speedMultiplier: 1,
  });
  act(() => {
    store().loadFrames(
      [frame(), frame(), frame(), frame()],
      [1000, 1000, 1000, 1000],
    );
  });
  renderHook(() => useReplayPlayerRunner());
});

afterEach(() => {
  cleanup();
});

describe('useReplayPlayerRunner', () => {
  it('정지 중에는 시간이 흘러도 프레임이 진행되지 않는다', () => {
    step(1);
    step(1);
    expect(store().frameIndex).toBe(0);
  });

  it('frame duration만큼 누적되면 tick — 1x에서 1000ms', () => {
    act(() => store().play());
    step(0.5);
    expect(store().frameIndex).toBe(0);
    step(0.4);
    expect(store().frameIndex).toBe(0);
    step(0.2); // 누적 1100ms ≥ 1000ms
    expect(store().frameIndex).toBe(1);
  });

  it('배속은 유효 간격을 나눈다 — 2x에서 500ms', () => {
    act(() => store().play());
    act(() => store().setSpeed(2));
    step(0.5); // 500ms ≥ 1000/2
    expect(store().frameIndex).toBe(1);
  });

  it('배속 변경 시 잔여 누적을 버린다 — 새 간격으로 다시 센다', () => {
    act(() => store().play());
    step(0.9); // 900ms 누적 (tick 안 됨)
    act(() => store().setSpeed(2)); // 리셋 — 이월되면 900+400 ≥ 500으로 즉시 tick됐을 것
    step(0.4);
    expect(store().frameIndex).toBe(0);
    step(0.11); // 510ms ≥ 500ms
    expect(store().frameIndex).toBe(1);
  });

  it('외부 seek(frameIndex 변경) 시 잔여 누적을 버린다', () => {
    act(() => store().play());
    step(0.9);
    act(() => useReplayPlayerStore.setState({ frameIndex: 2 })); // 재생 유지한 채 이동
    step(0.2); // 이월됐다면 1100ms로 즉시 tick됐을 것
    expect(store().frameIndex).toBe(2);
    step(0.9); // 200 + 900 = 1100ms ≥ 1000ms
    expect(store().frameIndex).toBe(3);
  });

  it('일시정지하면 누적이 리셋된다', () => {
    act(() => store().play());
    step(0.9);
    act(() => store().pause());
    step(0.5); // 정지 중 — 누적 리셋
    act(() => store().play());
    step(0.5); // 이월됐다면 1400ms로 tick됐을 것
    expect(store().frameIndex).toBe(0);
  });

  it('마지막 프레임에서 tick되면 재생이 멈춘다', () => {
    act(() => useReplayPlayerStore.setState({ frameIndex: 3 }));
    act(() => store().play());
    step(1.1);
    expect(store().frameIndex).toBe(3);
    expect(store().isPlaying).toBe(false);
  });
});
