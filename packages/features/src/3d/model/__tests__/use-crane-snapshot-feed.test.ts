// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { CraneScope } from '@crane/domain/monitoring';
import { useCraneSnapshotStore } from '../use-crane-snapshot-store';
import {
  craneSnapshotTopic,
  getCraneFeedUrl,
  resolveCraneFeedConnection,
  useCraneFeedConnection,
  useCraneSnapshotFeed,
} from '../use-crane-snapshot-feed';

/** STOMP 클라이언트를 가짜로 바꿔 구독 목적지·콜백·상태 리스너를 잡아 둔다. */
const stomp = vi.hoisted(() => ({
  state: 'idle' as string,
  active: false,
  topicHandler: null as null | ((body: unknown) => void),
  subscriptions: [] as { destination: string; handler: unknown }[],
  stateListeners: new Set<(state: string) => void>(),
  unsubscribeTopic: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
}));

const rest = vi.hoisted(() => ({
  getCraneSnapshots: vi.fn<(scope: string) => Promise<unknown[]>>(),
}));

vi.mock('@crane/core/ws', () => ({
  craneStompClient: {
    getUrl: () => 'ws://test.local/crane_rnd/ws',
    getState: () => stomp.state,
    isActive: () => stomp.active,
    subscribe: (destination: string, handler: (body: unknown) => void) => {
      stomp.topicHandler = handler;
      stomp.subscriptions.push({ destination, handler });
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
    getCraneSnapshots: (scope: string) => rest.getCraneSnapshots(scope),
  };
});

function crane(
  craneId: string,
  value: number | null,
  scope: CraneScope = 'indoor',
) {
  return {
    craneId,
    scope,
    stationId: null,
    bay: null,
    snapshotAt: null,
    lastReceivedAt: null,
    online: true,
    tags: { a: { value, quality: 0, timestamp: null } },
  };
}

function feed(scope: CraneScope = 'indoor') {
  return useCraneSnapshotStore.getState().byScope[scope];
}

function emitSocket(state: string, active = true) {
  stomp.state = state;
  stomp.active = active;
  for (const listener of stomp.stateListeners) listener(state);
}

beforeEach(() => {
  useCraneSnapshotStore.getState().clear();
  stomp.state = 'idle';
  stomp.active = false;
  stomp.topicHandler = null;
  stomp.subscriptions = [];
  stomp.stateListeners.clear();
  rest.getCraneSnapshots.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('craneSnapshotTopic', () => {
  it('범위의 묶음 토픽', () => {
    expect(craneSnapshotTopic('indoor')).toBe('/topic/indoor/cranes');
    expect(craneSnapshotTopic('outdoor')).toBe('/topic/outdoor/cranes');
  });
});

describe('useCraneSnapshotFeed', () => {
  it('꺼져 있거나 범위가 없으면 구독도 연결도 REST 조회도 하지 않는다', () => {
    renderHook(() => useCraneSnapshotFeed('indoor', false));
    renderHook(() => useCraneSnapshotFeed(null));
    renderHook(() => useCraneSnapshotFeed(null, true));
    expect(stomp.topicHandler).toBeNull();
    expect(stomp.acquire).not.toHaveBeenCalled();
    expect(rest.getCraneSnapshots).not.toHaveBeenCalled();
  });

  it('켜지면 그 범위의 REST 로 현재 상태를 받아 그 칸을 채우고 그 범위 토픽을 구독한다', async () => {
    rest.getCraneSnapshots.mockResolvedValue([crane('GC_01', 1, 'outdoor')]);
    renderHook(() => useCraneSnapshotFeed('outdoor'));
    expect(stomp.acquire).toHaveBeenCalledTimes(1);
    expect(rest.getCraneSnapshots).toHaveBeenCalledWith('outdoor');
    expect(stomp.subscriptions.map((s) => s.destination)).toEqual([
      '/topic/outdoor/cranes',
    ]);
    await act(async () => {
      await Promise.resolve();
    });
    expect(Object.keys(feed('outdoor').cranes)).toEqual(['GC_01']);
    expect(feed('indoor').cranes).toEqual({});
    expect(feed('outdoor').loadError).toBe(false);
  });

  it('REST 실패는 그 범위의 loadError 만 켜고 구독은 유지하며, 다음 성공이 다시 끈다', async () => {
    rest.getCraneSnapshots.mockRejectedValue(new Error('down'));
    const { unmount } = renderHook(() => useCraneSnapshotFeed('indoor'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(feed('indoor').loadError).toBe(true);
    expect(feed('outdoor').loadError).toBe(false);
    expect(stomp.release).not.toHaveBeenCalled();
    unmount();
    rest.getCraneSnapshots.mockResolvedValue([]);
    renderHook(() => useCraneSnapshotFeed('indoor'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(feed('indoor').loadError).toBe(false);
  });

  it('묶음 메시지의 크레인만 그 범위 칸에 반영하고 봉투가 아니면 무시한다', () => {
    renderHook(() => useCraneSnapshotFeed('indoor'));
    act(() => {
      stomp.topicHandler?.({
        type: 'snapshot',
        sentAt: null,
        cranes: [crane('C_2', 5), null],
      });
      stomp.topicHandler?.({ type: 'other', cranes: [crane('C_3', 1)] });
      stomp.topicHandler?.('garbage');
    });
    expect(Object.keys(feed('indoor').cranes)).toEqual(['C_2']);
    expect(feed('indoor').cranes.C_2.snapshot.tags.a.value).toBe(5);
    expect(feed('outdoor').cranes).toEqual({});
  });

  it('값 없음(null) 태그는 묶음에서도 null 로 들어온다', () => {
    renderHook(() => useCraneSnapshotFeed('outdoor'));
    act(() => {
      stomp.topicHandler?.({
        type: 'snapshot',
        sentAt: null,
        cranes: [crane('GC_01', null, 'outdoor')],
      });
    });
    expect(feed('outdoor').cranes.GC_01.snapshot.tags.a.value).toBeNull();
  });

  it('같은 범위의 화면 둘은 같은 핸들러를 넘기고, 범위가 다르면 핸들러도 다르다', () => {
    renderHook(() => useCraneSnapshotFeed('indoor'));
    renderHook(() => useCraneSnapshotFeed('indoor'));
    renderHook(() => useCraneSnapshotFeed('outdoor'));
    const [a, b, c] = stomp.subscriptions;
    expect(a?.handler).toBe(b?.handler);
    expect(c?.handler).not.toBe(a?.handler);
  });

  it('언마운트 시 구독·참조를 풀되 값은 남긴다', () => {
    const { unmount } = renderHook(() => useCraneSnapshotFeed('indoor'));
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
    expect(Object.keys(feed('indoor').cranes)).toEqual(['C_2']);
  });

  it('언마운트 뒤에 끝난 REST 응답은 버린다', async () => {
    let resolve: (value: unknown[]) => void = () => {};
    rest.getCraneSnapshots.mockReturnValue(
      new Promise<unknown[]>((r) => {
        resolve = r;
      }),
    );
    const { unmount } = renderHook(() => useCraneSnapshotFeed('indoor'));
    unmount();
    await act(async () => {
      resolve([crane('C_9', 1)]);
      await Promise.resolve();
    });
    expect(feed('indoor').cranes).toEqual({});
  });

  it('enabled 를 껐다 켜면 참조를 놓았다 다시 잡고 REST 부터 다시 받는다', () => {
    const { rerender } = renderHook(
      ({ enabled }) => useCraneSnapshotFeed('indoor', enabled),
      { initialProps: { enabled: true } },
    );
    expect(rest.getCraneSnapshots).toHaveBeenCalledTimes(1);
    rerender({ enabled: false });
    expect(stomp.release).toHaveBeenCalledTimes(1);
    rerender({ enabled: true });
    expect(stomp.acquire).toHaveBeenCalledTimes(2);
    expect(rest.getCraneSnapshots).toHaveBeenCalledTimes(2);
  });

  it('범위가 바뀌면 이전 범위 구독을 풀고 새 범위를 받는다', () => {
    const { rerender } = renderHook(
      ({ scope }: { scope: CraneScope | null }) => useCraneSnapshotFeed(scope),
      { initialProps: { scope: 'indoor' as CraneScope | null } },
    );
    rerender({ scope: 'outdoor' });
    expect(stomp.unsubscribeTopic).toHaveBeenCalledTimes(1);
    expect(stomp.release).toHaveBeenCalledTimes(1);
    expect(rest.getCraneSnapshots.mock.calls.map((call) => call[0])).toEqual([
      'indoor',
      'outdoor',
    ]);
    expect(stomp.subscriptions.map((s) => s.destination)).toEqual([
      '/topic/indoor/cranes',
      '/topic/outdoor/cranes',
    ]);
    rerender({ scope: null });
    expect(stomp.release).toHaveBeenCalledTimes(2);
    expect(stomp.acquire).toHaveBeenCalledTimes(2);
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
