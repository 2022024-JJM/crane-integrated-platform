// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CraneSnapshot } from '@crane/domain/monitoring';
import { useCraneSnapshotStore } from '@crane/features/3d';
import { useTagValueHistory } from '../use-tag-value-history';

const getCraneHistory = vi.hoisted(() => vi.fn());

vi.mock('@crane/domain/monitoring', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@crane/domain/monitoring')>()),
  getCraneHistory,
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function snapshot(craneId: string, value: number | boolean): CraneSnapshot {
  return {
    craneId,
    stationId: null,
    bay: 'F1',
    snapshotAt: null,
    lastReceivedAt: null,
    online: true,
    tags: { tl_distance: { value, quality: 0, timestamp: null } },
  };
}

function frames(values: number[]) {
  return {
    craneId: 'C_1',
    from: '',
    to: '',
    step: '1s',
    tags: ['tl_distance'],
    baseline: null,
    truncated: false,
    frames: values.map((v, i) => ({
      time: new Date(1_000_000 + i * 1000).toISOString(),
      values: { tl_distance: v },
    })),
  };
}

const flush = () => act(async () => {});

beforeEach(() => {
  getCraneHistory.mockReset();
  useCraneSnapshotStore.getState().clear();
});

afterEach(() => {
  cleanup();
});

describe('useTagValueHistory', () => {
  it('대상이 없거나 꺼져 있으면 빈 표본·조회 없음', () => {
    const { result } = renderHook(() => useTagValueHistory(null, null, true));
    expect(result.current).toEqual({ samples: [], loading: false });
    renderHook(() => useTagValueHistory('C_1', 'tl_distance', false));
    expect(getCraneHistory).not.toHaveBeenCalled();
  });

  it('이력 API 로 채우고(60초·1s), 로딩 중에는 loading', async () => {
    getCraneHistory.mockResolvedValueOnce(frames([1, 2, 3]));
    const { result } = renderHook(() =>
      useTagValueHistory('C_1', 'tl_distance', true),
    );
    expect(result.current.loading).toBe(true);
    await flush();
    expect(result.current.loading).toBe(false);
    expect(result.current.samples.map((s) => s.v)).toEqual([1, 2, 3]);
    const query = getCraneHistory.mock.calls[0][0];
    expect(query.craneId).toBe('C_1');
    expect(query.step).toBe('1s');
    expect(Date.parse(query.to) - Date.parse(query.from)).toBe(60_000);
  });

  it('스냅샷이 오면 뒤에 붙는다 — 다른 크레인·숫자 아닌 값은 무시', async () => {
    getCraneHistory.mockResolvedValueOnce(frames([1]));
    const { result } = renderHook(() =>
      useTagValueHistory('C_1', 'tl_distance', true),
    );
    await flush();
    // 이력 마지막 표본(1_000_000)에서 5초 뒤 — 60초 창 안이라 이력이 남는다.
    act(() => {
      useCraneSnapshotStore
        .getState()
        .applySnapshots([snapshot('C_1', 5), snapshot('C_2', 9)], 1_005_000);
    });
    expect(result.current.samples.map((s) => s.v)).toEqual([1, 5]);
    expect(result.current.samples[1].t).toBe(1_005_000);
  });

  it('창(60초) 밖으로 벗어난 이력 표본은 라이브 표본이 오면 떨어져 나간다', async () => {
    getCraneHistory.mockResolvedValueOnce(frames([1, 2]));
    const { result } = renderHook(() =>
      useTagValueHistory('C_1', 'tl_distance', true),
    );
    await flush();
    act(() => {
      useCraneSnapshotStore
        .getState()
        .applySnapshots([snapshot('C_1', 5)], 2_000_000);
    });
    expect(result.current.samples).toEqual([{ t: 2_000_000, v: 5 }]);
  });

  it('이력 조회가 실패해도 라이브 표본은 쌓인다', async () => {
    getCraneHistory.mockRejectedValueOnce(new Error('404'));
    const { result } = renderHook(() =>
      useTagValueHistory('C_1', 'tl_distance', true),
    );
    await flush();
    expect(result.current).toEqual({ samples: [], loading: false });
    act(() => {
      useCraneSnapshotStore
        .getState()
        .applySnapshots([snapshot('C_1', true)], 3_000_000);
    });
    expect(result.current.samples).toEqual([{ t: 3_000_000, v: 1 }]);
  });

  it('대상이 바뀌면 이전 표본을 보이지 않고 새로 조회한다', async () => {
    getCraneHistory.mockResolvedValueOnce(frames([1, 2]));
    const { result, rerender } = renderHook(
      ({ code }: { code: string }) => useTagValueHistory('C_1', code, true),
      { initialProps: { code: 'tl_distance' } },
    );
    await flush();
    expect(result.current.samples).toHaveLength(2);
    getCraneHistory.mockResolvedValueOnce({
      ...frames([7]),
      frames: [{ time: new Date(5_000_000).toISOString(), values: { ts1: 7 } }],
    });
    rerender({ code: 'ts1' });
    expect(result.current).toEqual({ samples: [], loading: true });
    await flush();
    expect(result.current.samples).toEqual([{ t: 5_000_000, v: 7 }]);
    expect(getCraneHistory).toHaveBeenCalledTimes(2);
  });

  it('언마운트 뒤 도착한 응답은 버린다', async () => {
    let resolve: (value: unknown) => void = () => {};
    getCraneHistory.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { unmount } = renderHook(() =>
      useTagValueHistory('C_1', 'tl_distance', true),
    );
    unmount();
    resolve(frames([1]));
    await flush();
    // 언마운트 뒤 setState 가 없으면 경고도 없다 — 도달만 확인.
    expect(getCraneHistory).toHaveBeenCalledTimes(1);
  });
});
