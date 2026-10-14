// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { publishTagValue } from '../tag-value-bus';
import { useRealtimeRunner } from '../use-realtime-runner';
import { useRealtimeStore } from '../use-realtime-store';

/** R3F 프레임 루프를 가로챈다(use-scene-collision-detector.test 와 같은 방식). */
const captured = vi.hoisted(() => ({
  frameCallback: null as null | (() => void),
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: () => void) => {
    captured.frameCallback = callback;
  },
}));

vi.mock('../tag-value-bus', () => ({
  publishTagValue: vi.fn(),
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function frame() {
  act(() => {
    captured.frameCallback?.();
  });
}

beforeEach(() => {
  useRealtimeStore.setState({
    isRunning: false,
    held: false,
    buffer: new Map(),
  });
  captured.frameCallback = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('useRealtimeRunner', () => {
  it('실행 중엔 매 프레임 버퍼를 비우고 순서대로 버스에 내보낸다', () => {
    useRealtimeStore.getState().start();
    renderHook(() => useRealtimeRunner());
    useRealtimeStore.getState().pushValue('c1:a', 1);
    useRealtimeStore.getState().pushValue('c1:b', 2);
    frame();
    expect(vi.mocked(publishTagValue).mock.calls).toEqual([
      ['c1:a', 1],
      ['c1:b', 2],
    ]);
    expect(useRealtimeStore.getState().buffer.size).toBe(0);
    // 빈 버퍼 프레임은 조용하다.
    frame();
    expect(publishTagValue).toHaveBeenCalledTimes(2);
  });

  it('한 프레임에 같은 키가 여러 번 오면 마지막 값만 한 번 내보낸다(코어레싱)', () => {
    useRealtimeStore.getState().start();
    renderHook(() => useRealtimeRunner());
    useRealtimeStore.getState().pushValue('c1:a', 1);
    useRealtimeStore.getState().pushValue('c1:b', 5);
    useRealtimeStore.getState().pushValue('c1:a', 2);
    useRealtimeStore.getState().pushValue('c1:a', 3);
    frame();
    expect(vi.mocked(publishTagValue).mock.calls).toEqual([
      ['c1:a', 3],
      ['c1:b', 5],
    ]);
  });

  it('같은 키의 두 번째 값부터는 직전 publish 와의 간격을 스무딩 시간으로 넘긴다(1Hz → 1초, 상·하한 적용)', () => {
    let nowMs = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    useRealtimeStore.getState().start();
    renderHook(() => useRealtimeRunner());
    useRealtimeStore.getState().pushValue('c1:a', 1);
    frame();
    expect(vi.mocked(publishTagValue).mock.calls[0]).toEqual(['c1:a', 1]);
    nowMs += 1000;
    useRealtimeStore.getState().pushValue('c1:a', 2);
    frame();
    expect(vi.mocked(publishTagValue).mock.calls[1]?.[2]).toEqual({
      smoothTime: 1,
    });
    nowMs += 20;
    useRealtimeStore.getState().pushValue('c1:a', 3);
    frame();
    expect(vi.mocked(publishTagValue).mock.calls[2]?.[2]?.smoothTime).toBe(0.1);
    nowMs += 30_000;
    useRealtimeStore.getState().pushValue('c1:a', 4);
    frame();
    expect(vi.mocked(publishTagValue).mock.calls[3]?.[2]?.smoothTime).toBe(2);
    // 다른 키는 자기 간격만 본다 — 첫 값이라 옵션 없음.
    useRealtimeStore.getState().pushValue('c1:b', 9);
    frame();
    expect(vi.mocked(publishTagValue).mock.calls[4]).toEqual(['c1:b', 9]);
  });

  it('stop 뒤 다시 start 하면 간격 표가 비어 첫 값은 기본 스무딩이다', () => {
    let nowMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    useRealtimeStore.getState().start();
    const { rerender } = renderHook(() => useRealtimeRunner());
    useRealtimeStore.getState().pushValue('c1:a', 1);
    frame();
    act(() => useRealtimeStore.getState().stop());
    rerender();
    act(() => useRealtimeStore.getState().start());
    rerender();
    nowMs += 500;
    useRealtimeStore.getState().pushValue('c1:a', 2);
    frame();
    expect(vi.mocked(publishTagValue).mock.calls.at(-1)).toEqual(['c1:a', 2]);
  });

  it('isRunning=false 면 drain 도 하지 않는다(버퍼 유지, 기존 동작 고정)', () => {
    renderHook(() => useRealtimeRunner());
    useRealtimeStore.getState().pushValue('c1:a', 1);
    frame();
    expect(publishTagValue).not.toHaveBeenCalled();
    expect(useRealtimeStore.getState().buffer.size).toBe(1);
  });

  it('held 면 버퍼는 비우되 내보내지 않고, release 뒤 프레임부터 다시 내보낸다', () => {
    useRealtimeStore.getState().start();
    renderHook(() => useRealtimeRunner());
    act(() => useRealtimeStore.getState().hold());
    useRealtimeStore.getState().pushValue('c1:a', 1);
    frame();
    expect(publishTagValue).not.toHaveBeenCalled();
    // 보류 중 수신 값은 버려진다 — 버퍼가 쌓이지 않는다.
    expect(useRealtimeStore.getState().buffer.size).toBe(0);

    act(() => useRealtimeStore.getState().release());
    frame(); // 보류 중 버린 값은 돌아오지 않는다.
    expect(publishTagValue).not.toHaveBeenCalled();
    useRealtimeStore.getState().pushValue('c1:a', 2);
    frame();
    expect(publishTagValue).toHaveBeenCalledTimes(1);
    expect(publishTagValue).toHaveBeenCalledWith('c1:a', 2);
  });

  it('hold 전에 쌓인 값도 held 프레임에서 함께 버려진다', () => {
    useRealtimeStore.getState().start();
    renderHook(() => useRealtimeRunner());
    useRealtimeStore.getState().pushValue('c1:a', 1);
    act(() => useRealtimeStore.getState().hold());
    frame();
    expect(publishTagValue).not.toHaveBeenCalled();
    expect(useRealtimeStore.getState().buffer.size).toBe(0);
  });
});
