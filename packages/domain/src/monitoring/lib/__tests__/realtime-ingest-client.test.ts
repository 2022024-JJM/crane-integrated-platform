import { describe, expect, it, vi } from 'vitest';
import {
  RealtimeIngestClient,
  createInlineTransport,
  type IngestTransport,
} from '../realtime-ingest-client';
import type { IngestCommand, IngestEvent } from '../realtime-ingest-protocol';

const POLICY = {
  enabled: false,
  initialIntervalMs: 1,
  maxIntervalMs: 1,
  backoffMultiplier: 1,
  jitterRatio: 0,
  maxAttempts: 0,
};

/** 가짜 전송 — 명령을 기록하고, 테스트가 이벤트를 직접 밀어 넣는다. */
function fakeTransport() {
  const calls: Array<IngestCommand | { t: 'stop' }> = [];
  let emit: ((event: IngestEvent) => void) | null = null;
  const factory = (onEvent: (event: IngestEvent) => void): IngestTransport => {
    emit = onEvent;
    return {
      start: (options) => {
        calls.push(options);
      },
      stop: () => {
        calls.push({ t: 'stop' });
      },
      setInterest: (keys) => {
        calls.push({ t: 'interest', keys });
      },
    };
  };
  return {
    factory,
    calls,
    emit: (event: IngestEvent) => emit?.(event),
  };
}

function client(t: ReturnType<typeof fakeTransport>, flushMs?: number) {
  return new RealtimeIngestClient({
    url: 'ws://x/ws',
    reconnect: POLICY,
    flushMs,
    createTransport: t.factory,
  });
}

function batch(
  ids: number[],
  values: number[],
  extra: Partial<Extract<IngestEvent, { t: 'batch' }>> = {},
): IngestEvent {
  return {
    t: 'batch',
    newKeyIds: null,
    newKeys: null,
    ids: Int32Array.from(ids),
    values: Float64Array.from(values),
    count: ids.length,
    received: ids.length,
    dropped: 0,
    busyMs: 0,
    ...extra,
  };
}

const flushMicrotasks = () => new Promise<void>((r) => queueMicrotask(r));

describe('RealtimeIngestClient — 연결 수명', () => {
  it('첫 acquire 가 관심 키 전달 + connect 명령을 보내고, 마지막 release 가 microtask 뒤 stop 한다', async () => {
    const t = fakeTransport();
    const c = client(t, 40);
    const r1 = c.acquire();
    const r2 = c.acquire();
    expect(t.calls).toEqual([
      // 배치 소비자가 아직 없으니 빈 목록(전부 버림) — 알람만 듣는 동안의 기본.
      { t: 'interest', keys: [] },
      {
        t: 'connect',
        url: 'ws://x/ws',
        protocols: undefined,
        reconnect: POLICY,
        flushMs: 40,
        heartbeatMs: 15_000,
      },
    ]);
    r1();
    await flushMicrotasks();
    expect(t.calls.at(-1)).not.toEqual({ t: 'stop' });
    r2();
    r2(); // idempotent
    await flushMicrotasks();
    expect(t.calls.at(-1)).toEqual({ t: 'stop' });
    expect(t.calls.filter((x) => x.t === 'stop')).toHaveLength(1);
  });

  it('release 뒤 같은 microtask 안에 다시 acquire 하면 끊지 않는다(StrictMode 더블 마운트)', async () => {
    const t = fakeTransport();
    const c = client(t);
    const r = c.acquire();
    r();
    c.acquire();
    await flushMicrotasks();
    expect(t.calls.some((x) => x.t === 'stop')).toBe(false);
  });

  it('flushMs 생략 시 기본 주기를 쓴다', () => {
    const t = fakeTransport();
    client(t).acquire();
    const connect = t.calls.find((x) => x.t === 'connect') as Extract<
      IngestCommand,
      { t: 'connect' }
    >;
    expect(connect.flushMs).toBeGreaterThan(0);
  });

  it('상태 이벤트는 getState 와 리스너에 반영되고, 해제 뒤엔 오지 않는다', () => {
    const t = fakeTransport();
    const c = client(t);
    c.acquire();
    const seen: string[] = [];
    const off = c.subscribeState((s) => seen.push(s));
    expect(c.getState()).toBe('idle');
    t.emit({ t: 'state', state: 'connecting' });
    t.emit({ t: 'state', state: 'open' });
    expect(c.getState()).toBe('open');
    off();
    t.emit({ t: 'state', state: 'closed' });
    expect(seen).toEqual(['connecting', 'open']);
    expect(c.getState()).toBe('closed');
  });
});

describe('RealtimeIngestClient — 배치·사전', () => {
  it('새 키 사전을 합쳐 두고 배치 핸들러에 같은 keys 배열 참조로 넘긴다', () => {
    const t = fakeTransport();
    const c = client(t);
    c.acquire();
    const got: Array<{
      keys: readonly string[];
      pairs: Array<[string, number]>;
    }> = [];
    c.subscribeTagBatch((b) => {
      const pairs: Array<[string, number]> = [];
      for (let i = 0; i < b.count; i++)
        pairs.push([b.keys[b.ids[i]!]!, b.values[i]!]);
      got.push({ keys: b.keys, pairs });
    });
    t.emit(
      batch([0, 1], [1.5, 2], { newKeyIds: [0, 1], newKeys: ['a:x', 'a:y'] }),
    );
    t.emit(batch([1, 2], [3, 4], { newKeyIds: [2], newKeys: ['b:z'] }));
    expect(got[0]!.pairs).toEqual([
      ['a:x', 1.5],
      ['a:y', 2],
    ]);
    expect(got[1]!.pairs).toEqual([
      ['a:y', 3],
      ['b:z', 4],
    ]);
    expect(got[0]!.keys).toBe(got[1]!.keys);
    expect(c.getKeys()).toEqual(['a:x', 'a:y', 'b:z']);
  });

  it('count 0 배치(전부 관심 밖)는 통계만 올리고 핸들러를 부르지 않는다', () => {
    const t = fakeTransport();
    const c = client(t);
    c.acquire();
    const handler = vi.fn();
    c.subscribeTagBatch(handler);
    t.emit(batch([], [], { received: 500, dropped: 500 }));
    expect(handler).not.toHaveBeenCalled();
    expect(c.getStats()).toMatchObject({
      receivedTotal: 500,
      droppedTotal: 500,
      deliveredTotal: 0,
      batches: 1,
    });
    expect(c.getStats().lastBatchAt).toBeGreaterThan(0);
  });

  it('전송 쪽 busyMs 는 누계와 최근 사용률(배치 간격 대비)로 집계된다', () => {
    const t = fakeTransport();
    const c = client(t);
    c.acquire();
    t.emit(batch([], [], { busyMs: 5 }));
    expect(c.getStats().transportBusyMs).toBe(5);
    // 첫 배치는 간격을 모른다 → 0.
    expect(c.getStats().transportBusyRatio).toBe(0);
    t.emit(batch([], [], { busyMs: 10 }));
    expect(c.getStats().transportBusyMs).toBe(15);
    expect(c.getStats().transportBusyRatio).toBeGreaterThanOrEqual(0);
    expect(c.getStats().transportBusyRatio).toBeLessThanOrEqual(1);
  });

  it('통계는 배치마다 누적된다', () => {
    const t = fakeTransport();
    const c = client(t);
    c.acquire();
    t.emit(
      batch([0], [1], {
        newKeyIds: [0],
        newKeys: ['k'],
        received: 10,
        dropped: 9,
      }),
    );
    t.emit(batch([0], [2], { received: 3, dropped: 2 }));
    expect(c.getStats()).toMatchObject({
      receivedTotal: 13,
      droppedTotal: 11,
      deliveredTotal: 2,
      batches: 2,
    });
  });

  it('태그가 아닌 봉투는 subscribeMessages 로만 가고 배치 핸들러엔 가지 않는다', () => {
    const t = fakeTransport();
    const c = client(t);
    c.acquire();
    const onBatch = vi.fn();
    const onMessage = vi.fn();
    c.subscribeTagBatch(onBatch);
    const off = c.subscribeMessages(onMessage);
    const envelope = { type: 'alarm', payload: { eventType: 'alarm.changed' } };
    t.emit({ t: 'message', envelope });
    expect(onMessage).toHaveBeenCalledWith(envelope);
    expect(onBatch).not.toHaveBeenCalled();
    off();
    t.emit({ t: 'message', envelope });
    expect(onMessage).toHaveBeenCalledTimes(1);
  });
});

describe('RealtimeIngestClient — 관심 키', () => {
  it('연결 전에 둔 관심 키는 connect 직전에 전송으로 가고, 연결 뒤 변경은 즉시 간다', () => {
    const t = fakeTransport();
    const c = client(t);
    const keys = ['a:x'];
    c.setInterestKeys(keys);
    expect(t.calls).toEqual([]); // 전송이 아직 없다
    c.acquire();
    // 배치 소비자가 없으면 전송엔 빈 목록(전부 버림)이 간다.
    expect(t.calls[0]).toEqual({ t: 'interest', keys: [] });
    const off = c.subscribeTagBatch(() => {});
    expect(t.calls.at(-1)).toEqual({ t: 'interest', keys: ['a:x'] });
    keys.push('mutated'); // 호출자가 바꿔도 복사본은 그대로
    expect(c.getInterestKeys()).toEqual(['a:x']);
    c.setInterestKeys(null);
    expect(t.calls.at(-1)).toEqual({ t: 'interest', keys: null });
    // 마지막 소비자가 떠나면 다시 빈 목록 — 알람만 듣는 화면에서 태그를 메인까지 올리지 않는다.
    off();
    expect(t.calls.at(-1)).toEqual({ t: 'interest', keys: [] });
  });
});

describe('createInlineTransport — Worker 없는 환경 폴백', () => {
  it('가짜 소켓의 메시지를 병합해 flush 주기에 배치로, 알람은 묶음 봉투로 낸다', () => {
    vi.useFakeTimers();
    const sockets: Array<{
      listeners: Record<string, Array<(e: unknown) => void>>;
      close: () => void;
    }> = [];
    const socketFactory = () => {
      const listeners: Record<string, Array<(e: unknown) => void>> = {};
      const ws = {
        listeners,
        addEventListener: (type: string, fn: (e: unknown) => void) => {
          (listeners[type] ??= []).push(fn);
        },
        removeEventListener: (type: string, fn: (e: unknown) => void) => {
          listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
        },
        close: vi.fn(),
        send: vi.fn(),
      };
      sockets.push(ws);
      return ws as unknown as WebSocket;
    };
    const events: IngestEvent[] = [];
    const transport = createInlineTransport(
      (e) => events.push(e),
      socketFactory,
    );
    transport.start({
      t: 'connect',
      url: 'ws://x',
      reconnect: POLICY,
      flushMs: 20,
      heartbeatMs: 0,
    });
    const ws = sockets[0]!;
    ws.listeners.open?.forEach((fn) => fn({}));
    const tagMsg = (code: string, value: number) =>
      JSON.stringify({
        type: 'cranes-lite',
        payload: {
          eventType: 'snapshot.delta',
          craneId: 'C-1',
          tagCode: code,
          value,
          timestamp: 't',
          quality: 1,
          changed: true,
          occurredAt: 't',
        },
      });
    ws.listeners.message?.forEach((fn) => fn({ data: tagMsg('a', 1) }));
    ws.listeners.message?.forEach((fn) => fn({ data: tagMsg('a', 2) }));
    ws.listeners.message?.forEach((fn) =>
      fn({
        data: JSON.stringify({
          type: 'x',
          payload: { eventType: 'alarm.changed' },
        }),
      }),
    );
    // 알람도 배치도 flush 주기에 — 건마다 메인으로 가지 않는다.
    expect(events.filter((e) => e.t === 'messages')).toHaveLength(0);
    expect(events.filter((e) => e.t === 'batch')).toHaveLength(0);
    vi.advanceTimersByTime(20);
    const m = events.find((e) => e.t === 'messages') as Extract<
      IngestEvent,
      { t: 'messages' }
    >;
    expect(m.envelopes).toHaveLength(1);
    expect(m.envelopes[0]!.type).toBe('x');
    const b = events.find((e) => e.t === 'batch') as Extract<
      IngestEvent,
      { t: 'batch' }
    >;
    expect(b.newKeys).toEqual(['C_1:a']);
    expect(Array.from(b.values)).toEqual([2]);
    expect(b.received).toBe(2);
    expect(
      events
        .filter((e) => e.t === 'state')
        .map((e) => (e as { state: string }).state),
    ).toEqual(['connecting', 'open']);
    // stop 은 남은 값을 flush 하고 소켓을 닫는다.
    ws.listeners.message?.forEach((fn) => fn({ data: tagMsg('a', 9) }));
    transport.stop();
    const last = events.at(-1);
    expect(last?.t === 'state' && last.state === 'closed').toBe(true);
    expect(
      events
        .filter((e) => e.t === 'batch')
        .map((e) => Array.from((e as { values: Float64Array }).values)),
    ).toEqual([[2], [9]]);
    expect(ws.close).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('RealtimeIngestClient — 묶음 봉투', () => {
  it("'messages' 는 봉투마다 구독자에게 순서대로 간다", () => {
    const t = fakeTransport();
    const c = client(t);
    c.acquire();
    const seen: string[] = [];
    c.subscribeMessages((e) => seen.push(e.type));
    t.emit({
      t: 'messages',
      envelopes: [
        { type: 'a', payload: {} },
        { type: 'b', payload: {} },
      ],
    });
    expect(seen).toEqual(['a', 'b']);
  });
});
