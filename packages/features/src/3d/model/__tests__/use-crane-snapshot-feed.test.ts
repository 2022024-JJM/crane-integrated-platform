// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useCraneSnapshotStore } from '../use-crane-snapshot-store';
import {
  getCraneFeedUrl,
  resolveCraneFeedConnection,
  useCraneFeedConnection,
  useCraneSnapshotFeed,
} from '../use-crane-snapshot-feed';

/** STOMP 클라이언트를 가짜로 바꿔 구독 콜백·상태 리스너를 잡아 둔다. */
const stomp = vi.hoisted(() => ({
  state: 'idle' as string,
  active: false,
  topicHandler: null as null | ((body: unknown) => void),
  stateListeners: new Set<(state: string) => void>(),
  unsubscribeTopic: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
}));

const rest = vi.hoisted(() => ({
  getCraneSnapshots: vi.fn<() => Promise<unknown[]>>(),
}));

vi.mock('@crane/core/ws', () => ({
  craneStompClient: {
    getUrl: () => 'ws://test.local/crane_rnd/ws',
    getState: () => stomp.state,
    isActive: () => stomp.active,
    subscribe: (_destination: string, handler: (body: unknown) => void) => {
      stomp.topicHandler = handler;
      return stomp.unsubscribeTopic;
    },
    subscribeState: (listener: (state: string) => void) => {
      stomp.stateListeners.add(listener);
      return () => stomp.stateListeners.delete(listener);
    },
    acquire: () => {
      stomp.acquire();
      return stomp.release;
    },
  },
}));

vi.mock('@crane/domain/monitoring', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@crane/domain/monitoring')>();
  return {
    ...actual,
    getCraneSnapshots: () => rest.getCraneSnapshots(),
  };
});

function crane(craneId: string, value: number) {
  return {
    craneId,
    stationId: null,
    bay: null,
    snapshotAt: null,
    lastReceivedAt: null,
    online: true,
    tags: { a: { value, quality: 0, timestamp: null } },
  };
}

function cranes() {
  return useCraneSnapshotStore.getState().cranes;
}

function emitSocket(state: string, active = true) {
  stomp.state = state;
  stomp.active = active;
  for (const listener of stomp.stateListeners) listener(state);
}

beforeEach(() => {
  useCraneSnapshotStore.setState({ cranes: {}, order: [], loadError: false });
  stomp.state = 'idle';
  stomp.active = false;
  stomp.topicHandler = null;
  stomp.stateListeners.clear();
  rest.getCraneSnapshots.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useCraneSnapshotFeed', () => {
  it('꺼져 있으면 구독도 연결도 REST 조회도 하지 않는다', () => {
    renderHook(() => useCraneSnapshotFeed(false));
    expect(stomp.topicHandler).toBeNull();
    expect(stomp.acquire).not.toHaveBeenCalled();
    expect(rest.getCraneSnapshots).not.toHaveBeenCalled();
  });

  it('켜지면 REST 로 현재 상태를 받아 채우고 구독·연결한다', async () => {
    rest.getCraneSnapshots.mockResolvedValue([crane('C_1', 1)]);
    renderHook(() => useCraneSnapshotFeed(true));
    expect(stomp.acquire).toHaveBeenCalledTimes(1);
    expect(stomp.topicHandler).not.toBeNull();
    await act(async () => {
      await Promise.resolve();
    });
    expect(Object.keys(cranes())).toEqual(['C_1']);
    expect(useCraneSnapshotStore.getState().loadError).toBe(false);
  });

  it('REST 실패는 loadError 만 켜고 구독은 유지하며, 다음 성공이 다시 끈다', async () => {
    rest.getCraneSnapshots.mockRejectedValue(new Error('down'));
    const { unmount } = renderHook(() => useCraneSnapshotFeed(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(useCraneSnapshotStore.getState().loadError).toBe(true);
    expect(stomp.release).not.toHaveBeenCalled();
    unmount();
    rest.getCraneSnapshots.mockResolvedValue([]);
    renderHook(() => useCraneSnapshotFeed(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(useCraneSnapshotStore.getState().loadError).toBe(false);
  });

  it('묶음 메시지의 크레인만 스토어에 반영하고 봉투가 아니면 무시한다', () => {
    renderHook(() => useCraneSnapshotFeed(true));
    act(() => {
      stomp.topicHandler?.({
        type: 'snapshot',
        sentAt: null,
        cranes: [crane('C_2', 5), null],
      });
      stomp.topicHandler?.({ type: 'other', cranes: [crane('C_3', 1)] });
      stomp.topicHandler?.('garbage');
    });
    expect(Object.keys(cranes())).toEqual(['C_2']);
    expect(cranes().C_2.snapshot.tags.a.value).toBe(5);
  });

  it('언마운트 시 구독·참조를 풀되 값은 남긴다', () => {
    const { unmount } = renderHook(() => useCraneSnapshotFeed(true));
    act(() => {
      stomp.topicHandler?.({
        type: 'snapshot',
        sentAt: null,
        cranes: [crane('C_2', 5)],
      });
    });
    unmount();
    expect(stomp.unsubscribeTopic).toHaveBeenCalledTimes(1);
    expect(stomp.release).toHaveBeenCalledTimes(1);
    expect(Object.keys(cranes())).toEqual(['C_2']);
  });

  it('언마운트 뒤에 끝난 REST 응답은 버린다', async () => {
    let resolve: (value: unknown[]) => void = () => {};
    rest.getCraneSnapshots.mockReturnValue(
      new Promise<unknown[]>((r) => {
        resolve = r;
      }),
    );
    const { unmount } = renderHook(() => useCraneSnapshotFeed(true));
    unmount();
    await act(async () => {
      resolve([crane('C_9', 1)]);
      await Promise.resolve();
    });
    expect(cranes()).toEqual({});
  });

  it('enabled 를 껐다 켜면 참조를 놓았다 다시 잡고 REST 부터 다시 받는다', () => {
    const { rerender } = renderHook(
      ({ enabled }) => useCraneSnapshotFeed(enabled),
      { initialProps: { enabled: true } },
    );
    expect(rest.getCraneSnapshots).toHaveBeenCalledTimes(1);
    rerender({ enabled: false });
    expect(stomp.release).toHaveBeenCalledTimes(1);
    rerender({ enabled: true });
    expect(stomp.acquire).toHaveBeenCalledTimes(2);
    expect(rest.getCraneSnapshots).toHaveBeenCalledTimes(2);
  });
});

describe('useCraneFeedConnection', () => {
  it('클라이언트 상태 변화를 따라간다 — closed 는 active 여부로 reconnecting / off', () => {
    const { result } = renderHook(() => useCraneFeedConnection());
    expect(result.current).toBe('off');
    act(() => emitSocket('connecting'));
    expect(result.current).toBe('connecting');
    act(() => emitSocket('open'));
    expect(result.current).toBe('open');
    act(() => emitSocket('closed', true));
    expect(result.current).toBe('reconnecting');
    act(() => emitSocket('closed', false));
    expect(result.current).toBe('off');
  });

  it('언마운트하면 리스너를 푼다', () => {
    const { unmount } = renderHook(() => useCraneFeedConnection());
    expect(stomp.stateListeners.size).toBe(1);
    unmount();
    expect(stomp.stateListeners.size).toBe(0);
  });
});

describe('resolveCraneFeedConnection', () => {
  it('소켓 open·connecting 은 그대로, 나머지는 active 여부로 reconnecting / off', () => {
    expect(resolveCraneFeedConnection('open', true)).toBe('open');
    expect(resolveCraneFeedConnection('connecting', false)).toBe('connecting');
    expect(resolveCraneFeedConnection('closed', true)).toBe('reconnecting');
    expect(resolveCraneFeedConnection('closed', false)).toBe('off');
    expect(resolveCraneFeedConnection('idle', false)).toBe('off');
    expect(resolveCraneFeedConnection('idle', true)).toBe('reconnecting');
  });
});

describe('getCraneFeedUrl', () => {
  it('클라이언트의 브로커 주소를 그대로 돌려준다', () => {
    expect(getCraneFeedUrl()).toBe('ws://test.local/crane_rnd/ws');
  });
});
