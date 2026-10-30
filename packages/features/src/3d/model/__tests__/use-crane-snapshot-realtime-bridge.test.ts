// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { CraneScope, CraneSnapshot } from '@crane/domain/monitoring';
import { useCraneSnapshotStore } from '../use-crane-snapshot-store';
import { useRealtimeStore } from '../use-realtime-store';
import { useCraneSnapshotRealtimeBridge } from '../use-crane-snapshot-realtime-bridge';

/** STOMP 클라이언트를 가짜로 바꿔 구독 콜백·참조를 잡아 둔다. */
const stomp = vi.hoisted(() => ({
  topicHandler: null as null | ((body: unknown) => void),
  destinations: [] as string[],
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
    getState: () => 'open',
    isActive: () => true,
    subscribe: (destination: string, handler: (body: unknown) => void) => {
      stomp.topicHandler = handler;
      stomp.destinations.push(destination);
      return stomp.unsubscribeTopic;
    },
    subscribeState: () => () => {},
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
  tags: Record<string, number | boolean | null>,
  scope: CraneScope = 'indoor',
): CraneSnapshot {
  return {
    craneId,
    scope,
    stationId: null,
    bay: null,
    snapshotAt: null,
    lastReceivedAt: null,
    online: true,
    tags: Object.fromEntries(
      Object.entries(tags).map(([code, value]) => [
        code,
        { value, quality: 0, timestamp: null },
      ]),
    ),
  };
}

function batch(...cranes: unknown[]) {
  return { type: 'snapshot', sentAt: null, cranes };
}

function buffer() {
  return useRealtimeStore.getState().buffer;
}

function drain() {
  useRealtimeStore.getState().drainBuffer();
}

function apply(snapshots: CraneSnapshot[], scope: CraneScope = 'indoor') {
  useCraneSnapshotStore.getState().applySnapshots(scope, snapshots, 0);
}

/** REST 응답(마이크로태스크)이 스토어에 닿을 때까지 흘려보낸다. */
async function flushRest() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  useCraneSnapshotStore.getState().clear();
  useRealtimeStore.setState({
    isRunning: false,
    held: false,
    buffer: [],
    activity: { lastMessageAt: Number.NEGATIVE_INFINITY },
  });
  stomp.topicHandler = null;
  stomp.destinations = [];
  rest.getCraneSnapshots.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useCraneSnapshotRealtimeBridge', () => {
  it('범위가 없으면(꺼짐) 피드를 켜지 않고 스토어가 바뀌어도 버퍼에 쌓지 않는다', () => {
    renderHook(() => useCraneSnapshotRealtimeBridge(null));
    expect(stomp.acquire).not.toHaveBeenCalled();
    expect(rest.getCraneSnapshots).not.toHaveBeenCalled();
    act(() => {
      apply([crane('C_1', { a: 1 })]);
      apply([crane('GC_01', { a: 1 }, 'outdoor')], 'outdoor');
    });
    expect(buffer()).toEqual([]);
  });

  it('자기 범위만 받는다 — 그 범위의 REST·토픽이고 다른 범위 칸의 갱신은 쌓지 않는다', () => {
    renderHook(() => useCraneSnapshotRealtimeBridge('outdoor'));
    expect(rest.getCraneSnapshots).toHaveBeenCalledWith('outdoor');
    expect(stomp.destinations).toEqual(['/topic/outdoor/cranes']);
    act(() => {
      apply([crane('C_1', { a: 1 })], 'indoor');
    });
    expect(buffer()).toEqual([]);
    act(() => {
      apply([crane('GC_01', { a: 2 }, 'outdoor')], 'outdoor');
    });
    expect(buffer()).toEqual([{ key: 'GC_01.a', value: 2 }]);
  });

  it('값 없음(null)은 null 로 쌓고, 숫자로 못 바꾸는 값만 버린다 — 점이 든 원본 이름도 키가 된다', () => {
    renderHook(() => useCraneSnapshotRealtimeBridge('outdoor'));
    act(() => {
      apply(
        [
          crane(
            'GC_01',
            {
              '4_Crane.4_CR01.4_POS.04_Center_POS_y1': 3,
              '4_Crane.4_CR01.2_slow.52_TL_FW_slow_1': null,
            },
            'outdoor',
          ),
        ],
        'outdoor',
      );
    });
    expect(buffer()).toEqual([
      { key: 'GC_01.4_Crane.4_CR01.4_POS.04_Center_POS_y1', value: 3 },
      { key: 'GC_01.4_Crane.4_CR01.2_slow.52_TL_FW_slow_1', value: null },
    ]);
  });

  it('REST 스냅샷의 태그 전부를 craneId:code 키로 쌓는다 — 숫자 그대로, 상태 비트는 0/1, 하이픈은 언더스코어', async () => {
    rest.getCraneSnapshots.mockResolvedValue([
      crane('C-171', { tl_distance: 12.5, heartbeat: true, e_stop_on: false }),
    ]);
    renderHook(() => useCraneSnapshotRealtimeBridge('indoor'));
    expect(stomp.acquire).toHaveBeenCalledTimes(1);
    expect(buffer()).toEqual([]);
    await flushRest();
    expect(buffer()).toEqual([
      { key: 'C_171.tl_distance', value: 12.5 },
      { key: 'C_171.heartbeat', value: 1 },
      { key: 'C_171.e_stop_on', value: 0 },
    ]);
  });

  it('STOMP 묶음은 실린 크레인의 태그 전부를 다시 쌓고, 안 실린 크레인은 쌓지 않는다', () => {
    renderHook(() => useCraneSnapshotRealtimeBridge('indoor'));
    act(() => {
      stomp.topicHandler?.(
        batch(crane('C_1', { a: 1, b: 2 }), crane('C_2', { a: 3 })),
      );
    });
    expect(buffer()).toEqual([
      { key: 'C_1.a', value: 1 },
      { key: 'C_1.b', value: 2 },
      { key: 'C_2.a', value: 3 },
    ]);
    drain();
    // a 는 그대로, b 만 바뀐 묶음 — 바뀐 태그만이 아니라 C_1 전부가 온다.
    act(() => {
      stomp.topicHandler?.(batch(crane('C_1', { a: 1, b: 5 })));
    });
    expect(buffer()).toEqual([
      { key: 'C_1.a', value: 1 },
      { key: 'C_1.b', value: 5 },
    ]);
  });

  it('켤 때 스토어에 이미 있던 스냅샷 전부를 한 번 쌓는다', () => {
    apply([crane('C_7', { x: 4 }), crane('C_8', { x: 9 })]);
    renderHook(() => useCraneSnapshotRealtimeBridge('indoor'));
    expect(buffer()).toEqual([
      { key: 'C_7.x', value: 4 },
      { key: 'C_8.x', value: 9 },
    ]);
  });

  it('보류 해제 때 현재 스냅샷 전부를 다시 쌓고, 보류 진입·이미 풀린 상태의 release 는 쌓지 않는다', () => {
    apply([crane('C_7', { x: 4 })]);
    renderHook(() => useCraneSnapshotRealtimeBridge('indoor'));
    drain();
    act(() => useRealtimeStore.getState().hold());
    expect(buffer()).toEqual([]);
    act(() => useRealtimeStore.getState().release());
    expect(buffer()).toEqual([{ key: 'C_7.x', value: 4 }]);
    drain();
    act(() => useRealtimeStore.getState().release());
    expect(buffer()).toEqual([]);
  });

  it('스토어 참조가 그대로인 갱신은 쌓지 않는다 — loadError·빈 묶음', () => {
    renderHook(() => useCraneSnapshotRealtimeBridge('indoor'));
    act(() => {
      useCraneSnapshotStore.getState().setLoadError('indoor', true);
      stomp.topicHandler?.(batch());
    });
    expect(buffer()).toEqual([]);
  });

  it('모양이 깨진 태그 항목은 스토어에 들어오지 않아 버퍼에도 없다', () => {
    renderHook(() => useCraneSnapshotRealtimeBridge('indoor'));
    const broken: unknown = {
      ...crane('C_1', { ok: 1 }),
      tags: {
        ok: { value: 1, quality: 0, timestamp: null },
        bad: { value: 'ON', quality: 0, timestamp: null },
      },
    };
    act(() => {
      stomp.topicHandler?.(batch(broken));
    });
    expect(buffer()).toEqual([{ key: 'C_1.ok', value: 1 }]);
  });

  it('언마운트하면 피드를 놓고 그 뒤의 스냅샷·보류 해제는 쌓지 않는다', () => {
    const { unmount } = renderHook(() =>
      useCraneSnapshotRealtimeBridge('indoor'),
    );
    unmount();
    expect(stomp.unsubscribeTopic).toHaveBeenCalledTimes(1);
    expect(stomp.release).toHaveBeenCalledTimes(1);
    act(() => {
      apply([crane('C_1', { a: 1 })]);
      useRealtimeStore.getState().hold();
      useRealtimeStore.getState().release();
    });
    expect(buffer()).toEqual([]);
  });

  it('켜짐 → 꺼짐 전환도 피드를 놓고 구독을 푼다', () => {
    const { rerender } = renderHook(
      ({ scope }: { scope: CraneScope | null }) =>
        useCraneSnapshotRealtimeBridge(scope),
      { initialProps: { scope: 'indoor' as CraneScope | null } },
    );
    rerender({ scope: null });
    expect(stomp.release).toHaveBeenCalledTimes(1);
    act(() => {
      apply([crane('C_1', { a: 1 })]);
    });
    expect(buffer()).toEqual([]);
  });
});
