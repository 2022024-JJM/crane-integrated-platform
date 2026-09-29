// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { RUNNING_WINDOW_MS } from '../../lib/model-runtime-status';
import { publishTagValue, tagLiveValues } from '../tag-value-bus';
import {
  RUNTIME_STATUS_POLL_MS,
  useModelRuntimeStatuses,
  useModelStatusRecords,
} from '../use-model-runtime-statuses';

function scene(): SavedSceneInfo {
  return {
    maps: [],
    models: [
      {
        id: 'm1',
        equipName: 'GC',
        path: '/x.glb',
        opacity: 1,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        tagMappings: [
          {
            id: 't1',
            tagKey: 'GC_04:gantry',
            target: { kind: 'node', node: '', channel: 'position', axis: 'x' },
          },
        ],
      },
      {
        id: 'm2',
        equipName: 'no-mapping',
        path: '/y.glb',
        opacity: 1,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    ],
  } as unknown as SavedSceneInfo;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  tagLiveValues.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useModelRuntimeStatuses', () => {
  it('맵핑 없음은 unknown, 값이 오면 running → 멈추면 unknown(운전 전원 모름)', () => {
    const { result } = renderHook(() => useModelRuntimeStatuses(scene()));
    expect(result.current).toEqual({ m1: 'unknown', m2: 'unknown' });

    act(() => {
      publishTagValue('GC_04:gantry', 1);
      vi.advanceTimersByTime(RUNTIME_STATUS_POLL_MS);
    });
    expect(result.current.m1).toBe('running');

    // 같은 값이 계속 와도 변화가 아니다 — 창이 지나면 멈춘 것이고, 상태 태그가
    // 없어 운전 전원을 모르니 unknown 이다.
    act(() => {
      for (let i = 0; i < 12; i += 1) {
        vi.advanceTimersByTime(RUNTIME_STATUS_POLL_MS);
        publishTagValue('GC_04:gantry', 1);
      }
    });
    expect(vi.getMockedSystemTime()!.getTime() - 1_000_000).toBeGreaterThan(
      RUNNING_WINDOW_MS,
    );
    expect(result.current.m1).toBe('unknown');
    expect(result.current.m2).toBe('unknown');
  });

  it('상태가 그대로면 참조를 유지한다', () => {
    const { result } = renderHook(() => useModelRuntimeStatuses(scene()));
    const before = result.current;
    act(() => {
      vi.advanceTimersByTime(RUNTIME_STATUS_POLL_MS * 3);
    });
    expect(result.current).toBe(before);
  });

  it('언마운트 뒤에는 타이머가 돌지 않는다', () => {
    const { unmount } = renderHook(() => useModelRuntimeStatuses(scene()));
    unmount();
    expect(() =>
      vi.advanceTimersByTime(RUNTIME_STATUS_POLL_MS * 2),
    ).not.toThrow();
  });
});

/** 축 하나 + 상태 태그 넷을 단 모델 하나. */
function statusScene(): SavedSceneInfo {
  return {
    maps: [],
    models: [
      {
        id: 'm1',
        equipName: 'GC',
        path: '/x.glb',
        opacity: 1,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        tagMappings: [
          {
            id: 't1',
            tagKey: 'GC_04:gantry',
            target: { kind: 'node', node: '', channel: 'position', axis: 'x' },
          },
        ],
        statusTags: {
          controlOn: 'GC_04:on',
          fault: 'GC_04:fault',
          bypass: 'GC_04:bypass',
          freeSwing: 'GC_04:swing',
        },
      },
    ],
  } as unknown as SavedSceneInfo;
}

function poll(times = 1) {
  act(() => {
    vi.advanceTimersByTime(RUNTIME_STATUS_POLL_MS * times);
  });
}

describe('useModelStatusRecords', () => {
  it('씬이 없으면 두 기록 모두 빈다', () => {
    const { result } = renderHook(() => useModelStatusRecords(null));
    expect(result.current).toEqual({ runtime: {}, labels: {} });
  });

  it('아무것도 못 받았으면 unknown — 아이콘도 없다', () => {
    const scene = statusScene();
    const { result } = renderHook(() => useModelStatusRecords(scene));
    expect(result.current.runtime).toEqual({ m1: 'unknown' });
    expect(result.current.labels.m1).toEqual({
      tone: 'unknown',
      bypass: false,
      freeSwing: false,
    });
  });

  it('운전 전원·움직임·고장에 따라 라벨이 바뀌고 운전 상태가 같이 간다', () => {
    const scene = statusScene();
    const { result } = renderHook(() => useModelStatusRecords(scene));

    act(() => {
      publishTagValue('GC_04:on', 1);
      publishTagValue('GC_04:gantry', 1);
    });
    poll();
    expect(result.current.labels.m1.tone).toBe('running');
    expect(result.current.runtime.m1).toBe('running');

    // 축이 멈추고 창이 지나면 운전 전원 On(정지).
    act(() => {
      for (let i = 0; i < 12; i += 1) {
        vi.advanceTimersByTime(RUNTIME_STATUS_POLL_MS);
        publishTagValue('GC_04:gantry', 1);
        publishTagValue('GC_04:on', 1);
      }
    });
    expect(result.current.labels.m1.tone).toBe('standby');
    expect(result.current.runtime.m1).toBe('standby');

    act(() => publishTagValue('GC_04:fault', 1));
    poll();
    expect(result.current.labels.m1.tone).toBe('fault');
    expect(result.current.runtime.m1).toBe('fault');

    act(() => {
      publishTagValue('GC_04:fault', 0);
      publishTagValue('GC_04:on', 0);
    });
    poll();
    expect(result.current.labels.m1.tone).toBe('off');
    expect(result.current.runtime.m1).toBe('off');
  });

  it('상태 태그가 없는 모델 — 움직일 때만 가동, 멈추면 unknown', () => {
    const plain = scene();
    const { result } = renderHook(() => useModelStatusRecords(plain));
    act(() => publishTagValue('GC_04:gantry', 1));
    poll();
    expect(result.current.labels.m1.tone).toBe('running');
    expect(result.current.runtime.m1).toBe('running');

    act(() => {
      for (let i = 0; i < 12; i += 1) {
        vi.advanceTimersByTime(RUNTIME_STATUS_POLL_MS);
        publishTagValue('GC_04:gantry', 1);
      }
    });
    expect(result.current.labels.m1.tone).toBe('unknown');
    expect(result.current.runtime.m1).toBe('unknown');
    // 맵핑이 없는 모델도 unknown.
    expect(result.current.labels.m2.tone).toBe('unknown');
    expect(result.current.runtime.m2).toBe('unknown');
  });

  it('운전 전원이 꺼져 있으면 축 값이 흔들려도 가동으로 세지 않는다', () => {
    const scene = statusScene();
    const { result } = renderHook(() => useModelStatusRecords(scene));
    act(() => {
      publishTagValue('GC_04:on', 0);
      publishTagValue('GC_04:gantry', 5);
    });
    poll();
    expect(result.current.labels.m1.tone).toBe('off');
    expect(result.current.runtime.m1).toBe('off');
  });

  it('운전 상태는 언제나 라벨의 tone 과 같다', () => {
    const scene = statusScene();
    const { result } = renderHook(() => useModelStatusRecords(scene));
    const expectSame = () =>
      expect(result.current.runtime.m1).toBe(result.current.labels.m1.tone);
    expectSame();
    act(() => {
      publishTagValue('GC_04:on', 1);
      publishTagValue('GC_04:gantry', 3);
    });
    poll();
    expectSame();
    act(() => publishTagValue('GC_04:fault', 1));
    poll();
    expectSame();
    poll(60);
    expect(result.current.labels.m1.tone).toBe('offline');
    expectSame();
  });

  it('우회·자유선회가 바뀌면 라벨 기록만 바뀐다', () => {
    const scene = statusScene();
    const { result } = renderHook(() => useModelStatusRecords(scene));
    act(() => publishTagValue('GC_04:on', 1));
    poll();
    const before = result.current;
    // 운전 전원 비트가 바뀐 것은 움직임이 아니다 — 운전 전원 On(정지).
    expect(before.labels.m1).toEqual({
      tone: 'standby',
      bypass: false,
      freeSwing: false,
    });

    act(() => {
      publishTagValue('GC_04:bypass', 1);
      publishTagValue('GC_04:swing', 1);
    });
    poll();
    expect(result.current.labels.m1).toMatchObject({
      bypass: true,
      freeSwing: true,
    });
    expect(result.current.labels).not.toBe(before.labels);
    expect(result.current.runtime).toBe(before.runtime);
  });

  it('상태가 그대로면 두 기록과 묶음의 참조를 모두 유지한다', () => {
    const scene = statusScene();
    const { result } = renderHook(() => useModelStatusRecords(scene));
    act(() => {
      publishTagValue('GC_04:on', 1);
      publishTagValue('GC_04:bypass', 1);
    });
    poll(10);
    const before = result.current;
    act(() => {
      publishTagValue('GC_04:on', 1);
      publishTagValue('GC_04:bypass', 1);
    });
    poll(3);
    expect(result.current).toBe(before);
    expect(result.current.labels.m1).toBe(before.labels.m1);
  });

  it('paused 면 재판정하지 않아 수신이 끊겨도 마지막 기록을 유지한다', () => {
    const scene = statusScene();
    const { result, rerender } = renderHook(
      ({ paused }) => useModelStatusRecords(scene, { paused }),
      { initialProps: { paused: false } },
    );
    act(() => publishTagValue('GC_04:on', 1));
    poll();
    const before = result.current;
    rerender({ paused: true });
    poll(60);
    expect(result.current).toBe(before);

    // 풀리면 그동안 끊긴 수신이 드러난다.
    rerender({ paused: false });
    expect(result.current.labels.m1.tone).toBe('offline');
    expect(result.current.labels.m1.bypass).toBe(false);
  });

  it('값 캐시가 비워지면 다음 판정에서 unknown 으로 돌아간다', () => {
    const scene = statusScene();
    const { result } = renderHook(() => useModelStatusRecords(scene));
    act(() => {
      publishTagValue('GC_04:on', 1);
      publishTagValue('GC_04:bypass', 1);
    });
    poll();
    expect(result.current.labels.m1.bypass).toBe(true);
    act(() => tagLiveValues.clear());
    poll();
    expect(result.current.labels.m1).toEqual({
      tone: 'unknown',
      bypass: false,
      freeSwing: false,
    });
  });

  it('언마운트 뒤에는 타이머가 돌지 않는다', () => {
    const scene = statusScene();
    const { unmount } = renderHook(() => useModelStatusRecords(scene));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
