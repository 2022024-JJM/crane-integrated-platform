// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { RUNNING_WINDOW_MS } from '../../lib/model-runtime-status';
import { publishTagValue, tagLiveValues } from '../tag-value-bus';
import {
  RUNTIME_STATUS_POLL_MS,
  useModelRuntimeStatuses,
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
  it('맵핑 없음은 unknown, 값이 오면 running → 창이 지나면 idle', () => {
    const { result } = renderHook(() => useModelRuntimeStatuses(scene()));
    expect(result.current).toEqual({ m1: 'unknown', m2: 'unknown' });

    act(() => {
      publishTagValue('GC_04:gantry', 1);
      vi.advanceTimersByTime(RUNTIME_STATUS_POLL_MS);
    });
    expect(result.current.m1).toBe('running');

    // 같은 값이 계속 와도 변화가 아니라 running 창이 지나면 idle.
    act(() => {
      for (let i = 0; i < 12; i += 1) {
        vi.advanceTimersByTime(RUNTIME_STATUS_POLL_MS);
        publishTagValue('GC_04:gantry', 1);
      }
    });
    expect(vi.getMockedSystemTime()!.getTime() - 1_000_000).toBeGreaterThan(
      RUNNING_WINDOW_MS,
    );
    expect(result.current.m1).toBe('idle');
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
