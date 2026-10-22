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

/** 러너가 간격을 재는 시계(performance.now) — 테스트가 직접 옮긴다. */
let nowMs = 0;

beforeEach(() => {
  useRealtimeStore.setState({ isRunning: false, held: false, buffer: [] });
  captured.frameCallback = null;
  nowMs = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
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
    expect(useRealtimeStore.getState().buffer).toEqual([]);
    // 빈 버퍼 프레임은 조용하다.
    frame();
    expect(publishTagValue).toHaveBeenCalledTimes(2);
  });

  it('isRunning=false 면 drain 도 하지 않는다(버퍼 유지, 기존 동작 고정)', () => {
    renderHook(() => useRealtimeRunner());
    useRealtimeStore.getState().pushValue('c1:a', 1);
    frame();
    expect(publishTagValue).not.toHaveBeenCalled();
    expect(useRealtimeStore.getState().buffer).toHaveLength(1);
  });

  it('held 면 버퍼는 비우되 내보내지 않고, release 뒤 프레임부터 다시 내보낸다', () => {
    useRealtimeStore.getState().start();
    renderHook(() => useRealtimeRunner());
    act(() => useRealtimeStore.getState().hold());
    useRealtimeStore.getState().pushValue('c1:a', 1);
    frame();
    expect(publishTagValue).not.toHaveBeenCalled();
    // 보류 중 수신 값은 버려진다 — 버퍼가 쌓이지 않는다.
    expect(useRealtimeStore.getState().buffer).toEqual([]);

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
    expect(useRealtimeStore.getState().buffer).toEqual([]);
  });

  describe('수신 간격 스무딩', () => {
    it('첫 값은 옵션 없이(소비자 기본), 값이 바뀌면 직전 변화와의 간격을 smoothTime 으로 넘긴다', () => {
      useRealtimeStore.getState().start();
      renderHook(() => useRealtimeRunner());
      useRealtimeStore.getState().pushValue('c1:a', 1);
      frame();
      expect(publishTagValue).toHaveBeenLastCalledWith('c1:a', 1);

      nowMs = 1000;
      useRealtimeStore.getState().pushValue('c1:a', 2);
      frame();
      expect(publishTagValue).toHaveBeenLastCalledWith('c1:a', 2, {
        smoothTime: 1,
      });

      nowMs = 1500;
      useRealtimeStore.getState().pushValue('c1:a', 3);
      frame();
      expect(publishTagValue).toHaveBeenLastCalledWith('c1:a', 3, {
        smoothTime: 0.5,
      });
    });

    it('바뀌지 않은 재발행(250ms 묶음)은 마지막 스무딩 시간을 그대로 넘긴다 — 진행 중 스무딩이 잘리지 않게', () => {
      useRealtimeStore.getState().start();
      renderHook(() => useRealtimeRunner());
      useRealtimeStore.getState().pushValue('c1:a', 1);
      frame();
      nowMs = 1000;
      useRealtimeStore.getState().pushValue('c1:a', 2);
      frame();
      for (const t of [1250, 1500, 1750]) {
        nowMs = t;
        useRealtimeStore.getState().pushValue('c1:a', 2);
        frame();
        expect(publishTagValue).toHaveBeenLastCalledWith('c1:a', 2, {
          smoothTime: 1,
        });
      }
      // 첫 값의 재발행은 아직 간격을 몰라 옵션이 없다.
      useRealtimeStore.getState().pushValue('c1:b', 7);
      frame();
      nowMs = 2000;
      useRealtimeStore.getState().pushValue('c1:b', 7);
      frame();
      expect(publishTagValue).toHaveBeenLastCalledWith('c1:b', 7);
    });

    it('한 프레임의 항목은 같은 시각으로 잰다 — 키마다 독립', () => {
      useRealtimeStore.getState().start();
      renderHook(() => useRealtimeRunner());
      useRealtimeStore.getState().pushValue('c1:a', 1);
      frame();
      nowMs = 500;
      useRealtimeStore.getState().pushValue('c1:b', 1);
      frame();
      nowMs = 1000;
      useRealtimeStore.getState().pushValue('c1:a', 2);
      useRealtimeStore.getState().pushValue('c1:b', 2);
      frame();
      expect(vi.mocked(publishTagValue).mock.calls.slice(-2)).toEqual([
        ['c1:a', 2, { smoothTime: 1 }],
        ['c1:b', 2, { smoothTime: 0.5 }],
      ]);
    });

    it('stop → start 뒤에는 간격 표가 비어 첫 값 취급이다', () => {
      act(() => useRealtimeStore.getState().start());
      renderHook(() => useRealtimeRunner());
      useRealtimeStore.getState().pushValue('c1:a', 1);
      frame();
      nowMs = 1000;
      useRealtimeStore.getState().pushValue('c1:a', 2);
      frame();
      expect(publishTagValue).toHaveBeenLastCalledWith('c1:a', 2, {
        smoothTime: 1,
      });

      act(() => useRealtimeStore.getState().stop());
      act(() => useRealtimeStore.getState().start());
      nowMs = 2000;
      useRealtimeStore.getState().pushValue('c1:a', 3);
      frame();
      // 이전 세션의 변경 시각(1000ms)과 재지 않는다.
      expect(publishTagValue).toHaveBeenLastCalledWith('c1:a', 3);
      nowMs = 2250;
      useRealtimeStore.getState().pushValue('c1:a', 4);
      frame();
      expect(publishTagValue).toHaveBeenLastCalledWith('c1:a', 4, {
        smoothTime: 0.25,
      });
    });

    it('보류 중 버린 값은 간격 측정에 들어가지 않는다 — 해제 뒤 첫 값은 기본, 다음 변화부터 간격', () => {
      useRealtimeStore.getState().start();
      renderHook(() => useRealtimeRunner());
      act(() => useRealtimeStore.getState().hold());
      useRealtimeStore.getState().pushValue('c1:a', 1);
      frame();
      act(() => useRealtimeStore.getState().release());

      nowMs = 1000;
      useRealtimeStore.getState().pushValue('c1:a', 2);
      frame();
      expect(publishTagValue).toHaveBeenLastCalledWith('c1:a', 2);
      nowMs = 2000;
      useRealtimeStore.getState().pushValue('c1:a', 3);
      frame();
      expect(publishTagValue).toHaveBeenLastCalledWith('c1:a', 3, {
        smoothTime: 1,
      });
    });
  });
});
