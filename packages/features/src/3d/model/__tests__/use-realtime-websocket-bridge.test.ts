// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useRealtimeStore } from '../use-realtime-store';
import { useRealtimeWebSocketBridge } from '../use-realtime-websocket-bridge';

/** 소켓을 가짜로 바꿔 구독 콜백을 잡아 둔다 — 실네트워크 없이 메시지를 주입한다. */
const socket = vi.hoisted(() => ({
  handler: null as null | ((message: { payload: unknown }) => void),
  unsubscribe: vi.fn(),
  release: vi.fn(),
  acquire: vi.fn(),
}));

vi.mock('@crane/core/ws', () => ({
  cranesLiteWebSocketClient: {
    subscribeAll: (handler: (message: { payload: unknown }) => void) => {
      socket.handler = handler;
      return socket.unsubscribe;
    },
    acquire: () => {
      socket.acquire();
      return socket.release;
    },
  },
}));

function message(value: unknown, overrides: Record<string, unknown> = {}) {
  return {
    payload: {
      eventType: 'snapshot.delta',
      craneId: 'C-171',
      tagCode: 'crane_control_on',
      value,
      timestamp: '2026-01-01T00:00:00Z',
      quality: 192,
      changed: true,
      occurredAt: '2026-01-01T00:00:00Z',
      ...overrides,
    },
  };
}

function buffer() {
  return useRealtimeStore.getState().buffer;
}

beforeEach(() => {
  useRealtimeStore.setState({ isRunning: false, held: false, buffer: [] });
  socket.handler = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useRealtimeWebSocketBridge', () => {
  it('꺼져 있으면 구독도 연결도 하지 않는다', () => {
    renderHook(() => useRealtimeWebSocketBridge(false));
    expect(socket.handler).toBeNull();
    expect(socket.acquire).not.toHaveBeenCalled();
  });

  it('숫자 값은 craneId 의 하이픈을 언더스코어로 바꾼 키로 버퍼에 쌓는다', () => {
    renderHook(() => useRealtimeWebSocketBridge(true));
    socket.handler?.(message(12.5, { tagCode: 'tl_distance' }));
    expect(buffer()).toEqual([{ key: 'C_171:tl_distance', value: 12.5 }]);
  });

  it("상태 비트는 0/1 로 쌓는다 — boolean 과 'true'/'false' 문자열", () => {
    renderHook(() => useRealtimeWebSocketBridge(true));
    socket.handler?.(message(true));
    socket.handler?.(message(false));
    socket.handler?.(message('true'));
    socket.handler?.(message('false'));
    expect(buffer().map((entry) => entry.value)).toEqual([1, 0, 1, 0]);
    expect(buffer()[0]?.key).toBe('C_171:crane_control_on');
  });

  it('숫자로 못 바꾸는 값은 버린다 — null·숫자 문자열·그 밖의 문자열', () => {
    renderHook(() => useRealtimeWebSocketBridge(true));
    socket.handler?.(message(null));
    socket.handler?.(message('12'));
    socket.handler?.(message('ON'));
    socket.handler?.(message(''));
    expect(buffer()).toEqual([]);
  });

  it('형식이 깨진 메시지는 버린다 — eventType 불일치·필드 결손·payload 아님', () => {
    renderHook(() => useRealtimeWebSocketBridge(true));
    socket.handler?.(message(1, { eventType: 'alarm' }));
    socket.handler?.(message(1, { craneId: undefined }));
    socket.handler?.(message(1, { quality: 'good' }));
    socket.handler?.({ payload: null });
    socket.handler?.({ payload: 'text' });
    expect(buffer()).toEqual([]);
  });

  it('언마운트하면 구독을 풀고 연결을 놓는다', () => {
    const { unmount } = renderHook(() => useRealtimeWebSocketBridge(true));
    expect(socket.acquire).toHaveBeenCalledTimes(1);
    unmount();
    expect(socket.unsubscribe).toHaveBeenCalledTimes(1);
    expect(socket.release).toHaveBeenCalledTimes(1);
  });

  it('켜짐 → 꺼짐 전환도 구독을 풀고 연결을 놓는다', () => {
    const { rerender } = renderHook(
      ({ enabled }) => useRealtimeWebSocketBridge(enabled),
      { initialProps: { enabled: true } },
    );
    rerender({ enabled: false });
    expect(socket.unsubscribe).toHaveBeenCalledTimes(1);
    expect(socket.release).toHaveBeenCalledTimes(1);
  });
});
