// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { TagBatch } from '@crane/domain/monitoring';
import { useRealtimeStore } from '../use-realtime-store';
import { useRealtimeWebSocketBridge } from '../use-realtime-websocket-bridge';

/** 수신 클라이언트를 가짜로 바꿔 배치 핸들러를 잡아 둔다 — 실네트워크 없이 배치를 주입한다. */
const ingest = vi.hoisted(() => ({
  handler: null as null | ((batch: TagBatch) => void),
  unsubscribe: vi.fn(),
  release: vi.fn(),
  acquire: vi.fn(),
  setInterestKeys: vi.fn(),
}));

vi.mock('@crane/domain/monitoring', () => ({
  cranesLiteIngestClient: {
    subscribeTagBatch: (handler: (batch: TagBatch) => void) => {
      ingest.handler = handler;
      return ingest.unsubscribe;
    },
    acquire: () => {
      ingest.acquire();
      return ingest.release;
    },
    setInterestKeys: (keys: readonly string[] | null) =>
      ingest.setInterestKeys(keys),
  },
}));

function batch(keys: string[], pairs: Array<[number, number]>): TagBatch {
  return {
    keys,
    ids: Int32Array.from(pairs.map(([id]) => id)),
    values: Float64Array.from(pairs.map(([, v]) => v)),
    count: pairs.length,
    received: pairs.length,
    dropped: 0,
    busyMs: 0,
  };
}

function buffer() {
  return useRealtimeStore.getState().buffer;
}

beforeEach(() => {
  useRealtimeStore.setState({
    isRunning: false,
    held: false,
    buffer: new Map(),
  });
  ingest.handler = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useRealtimeWebSocketBridge', () => {
  it('꺼져 있으면 구독도 연결도 관심 키 전달도 하지 않는다', () => {
    renderHook(() => useRealtimeWebSocketBridge(false, ['a:b']));
    expect(ingest.handler).toBeNull();
    expect(ingest.acquire).not.toHaveBeenCalled();
    expect(ingest.setInterestKeys).not.toHaveBeenCalled();
  });

  it('배치의 id 를 키 사전으로 풀어 버퍼에 넣는다', () => {
    renderHook(() => useRealtimeWebSocketBridge(true));
    ingest.handler?.(
      batch(
        ['C_171:tl_distance', 'C_171:ts_distance'],
        [
          [0, 12.5],
          [1, 3],
        ],
      ),
    );
    expect([...buffer()]).toEqual([
      ['C_171:tl_distance', 12.5],
      ['C_171:ts_distance', 3],
    ]);
    expect(ingest.acquire).toHaveBeenCalledTimes(1);
  });

  it('사전에 없는 id(배열 밖)는 버린다 — 배치 순서가 어긋나도 깨지지 않는다', () => {
    renderHook(() => useRealtimeWebSocketBridge(true));
    ingest.handler?.(batch(['k'], [[5, 1]]));
    expect(buffer().size).toBe(0);
  });

  it('수신 시각(activity)을 배치마다 제자리 갱신한다', () => {
    renderHook(() => useRealtimeWebSocketBridge(true));
    const before = useRealtimeStore.getState();
    ingest.handler?.(batch(['k'], [[0, 1]]));
    expect(useRealtimeStore.getState()).toBe(before);
    expect(before.activity.lastMessageAt).toBeGreaterThan(0);
  });

  it('관심 키를 켤 때 넘기고, 바뀌면 다시 넘기고, 끌 때 null 로 되돌린다', () => {
    const first = ['a:x'];
    const { rerender, unmount } = renderHook(
      ({ keys }: { keys: readonly string[] | null }) =>
        useRealtimeWebSocketBridge(true, keys),
      { initialProps: { keys: first as readonly string[] | null } },
    );
    expect(ingest.setInterestKeys).toHaveBeenLastCalledWith(first);
    // 같은 참조면 다시 보내지 않는다.
    rerender({ keys: first });
    expect(ingest.setInterestKeys).toHaveBeenCalledTimes(1);
    const second = ['a:x', 'a:y'];
    rerender({ keys: second });
    // 이전 effect cleanup(null) → 새 값. 마지막은 새 값이다.
    expect(ingest.setInterestKeys).toHaveBeenLastCalledWith(second);
    unmount();
    expect(ingest.setInterestKeys).toHaveBeenLastCalledWith(null);
  });

  it('언마운트하면 구독을 풀고 연결을 놓는다', () => {
    const { unmount } = renderHook(() => useRealtimeWebSocketBridge(true));
    unmount();
    expect(ingest.unsubscribe).toHaveBeenCalledTimes(1);
    expect(ingest.release).toHaveBeenCalledTimes(1);
  });
});
