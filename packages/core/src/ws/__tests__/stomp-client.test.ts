import { describe, expect, it, vi } from 'vitest';
import {
  StompClient,
  type StompClientOptions,
  type StompTransport,
  type StompTransportConfig,
} from '../stomp-client';

/**
 * stompjs Client 를 흉내 내는 가짜 전송 계층 — 테스트가 연결·끊김·메시지를
 * 손으로 일으킨다. 실제 소켓·타이머는 없다.
 */
class FakeTransport implements StompTransport {
  connected = false;
  activateCalls = 0;
  deactivateCalls = 0;
  readonly subscriptions = new Map<
    string,
    { callback: (message: { body: string }) => void }
  >();
  readonly unsubscribeLog: string[] = [];
  readonly config: StompTransportConfig;

  constructor(config: StompTransportConfig) {
    this.config = config;
  }

  activate() {
    this.activateCalls += 1;
  }

  deactivate() {
    this.deactivateCalls += 1;
    this.connected = false;
    return Promise.resolve();
  }

  subscribe(
    destination: string,
    callback: (message: { body: string }) => void,
  ) {
    const entry = { callback };
    this.subscriptions.set(destination, entry);
    return {
      unsubscribe: () => {
        this.unsubscribeLog.push(destination);
        this.subscriptions.delete(destination);
      },
    };
  }

  /** 서버가 CONNECTED 프레임을 보낸 상황. */
  simulateConnect() {
    this.connected = true;
    this.config.onConnect();
  }

  /** 소켓이 닫힌 상황 — stompjs 는 구독을 전부 잊는다. */
  simulateClose() {
    this.connected = false;
    this.subscriptions.clear();
    this.config.onWebSocketClose();
  }

  deliver(destination: string, body: string) {
    this.subscriptions.get(destination)?.callback({ body });
  }
}

/**
 * 전송 계층은 첫 connect 에서 만들어지므로 `transport` 는 그 뒤에 읽는다
 * (getter — 구조분해하지 않는다).
 */
function createClient(options: Partial<StompClientOptions> = {}) {
  let transport: FakeTransport | null = null;
  const client = new StompClient({
    url: 'ws://example.test/ws',
    reconnectDelayMs: 1_000,
    clientFactory: (config) => {
      transport = new FakeTransport(config);
      return transport;
    },
    ...options,
  });
  return {
    client,
    get transport(): FakeTransport {
      if (!transport) throw new Error('transport not created yet');
      return transport;
    },
  };
}

const flushMicrotasks = () =>
  new Promise<void>((resolve) => queueMicrotask(resolve));

describe('StompClient — 연결 수명', () => {
  it('첫 acquire 가 전송 계층을 만들어 activate 하고, 두 번째 acquire 는 그대로 쓴다', () => {
    const c = createClient();
    expect(c.client.getState()).toBe('idle');
    const releaseA = c.client.acquire();
    expect(c.client.getState()).toBe('connecting');
    expect(c.transport.activateCalls).toBe(1);
    expect(c.transport.config.brokerURL).toBe('ws://example.test/ws');
    const releaseB = c.client.acquire();
    expect(c.transport.activateCalls).toBe(1);
    releaseA();
    releaseB();
  });

  it('CONNECTED 프레임에 open, 소켓 닫힘에 closed 가 되고 isActive 는 재연결 대기를 알린다', () => {
    const c = createClient();
    const states: string[] = [];
    c.client.subscribeState((state) => states.push(state));
    c.client.acquire();
    c.transport.simulateConnect();
    expect(c.client.getState()).toBe('open');
    expect(c.client.isActive()).toBe(true);
    c.transport.simulateClose();
    expect(c.client.getState()).toBe('closed');
    // 사용자가 끊은 게 아니라 stompjs 가 reconnectDelay 뒤 다시 붙는다.
    expect(c.client.isActive()).toBe(true);
    expect(states).toEqual(['connecting', 'open', 'closed']);
  });

  it('재연결이 꺼져 있으면(reconnectDelayMs 0) 끊긴 뒤 isActive 가 false 다', () => {
    const c = createClient({ reconnectDelayMs: 0 });
    c.client.acquire();
    c.transport.simulateConnect();
    c.transport.simulateClose();
    expect(c.client.isActive()).toBe(false);
  });

  it('idle 이면 isActive 가 false 다', () => {
    const c = createClient();
    expect(c.client.isActive()).toBe(false);
  });

  it('getUrl 은 브로커 주소를 돌려준다', () => {
    const c = createClient();
    expect(c.client.getUrl()).toBe('ws://example.test/ws');
  });

  it('마지막 release 는 microtask 뒤에 deactivate 한다 — 같은 틱의 재획득(StrictMode)은 끊지 않는다', async () => {
    const c = createClient();
    const release = c.client.acquire();
    c.transport.simulateConnect();
    release();
    c.client.acquire();
    await flushMicrotasks();
    expect(c.transport.deactivateCalls).toBe(0);
    expect(c.client.getState()).toBe('open');
  });

  it('release 는 idempotent 고, 참조가 0 이 되면 closed 로 끊는다', async () => {
    const c = createClient();
    const release = c.client.acquire();
    c.transport.simulateConnect();
    release();
    release();
    await flushMicrotasks();
    expect(c.transport.deactivateCalls).toBe(1);
    expect(c.client.getState()).toBe('closed');
    expect(c.client.isActive()).toBe(false);
  });

  it('disconnect 뒤 소켓 닫힘 알림이 와도 closed 를 두 번 알리지 않는다', () => {
    const c = createClient();
    const listener = vi.fn();
    c.client.acquire();
    c.transport.simulateConnect();
    c.client.subscribeState(listener);
    c.client.disconnect();
    c.transport.simulateClose();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('closed');
  });

  it('disconnect 뒤 connect 하면 같은 전송 계층을 다시 activate 한다', () => {
    const c = createClient();
    c.client.connect();
    c.transport.simulateConnect();
    c.client.disconnect();
    c.client.connect();
    expect(c.transport.activateCalls).toBe(2);
    expect(c.client.getState()).toBe('connecting');
    expect(c.client.isActive()).toBe(true);
  });

  it('connect 는 connecting · open 상태에서 no-op 이다', () => {
    const c = createClient();
    c.client.connect();
    c.client.connect();
    expect(c.transport.activateCalls).toBe(1);
    c.transport.simulateConnect();
    c.client.connect();
    expect(c.transport.activateCalls).toBe(1);
  });

  it('subscribeState 해제 뒤에는 알림이 오지 않는다', () => {
    const c = createClient();
    const listener = vi.fn();
    const off = c.client.subscribeState(listener);
    c.client.connect();
    off();
    c.transport.simulateConnect();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('connecting');
  });
});

describe('StompClient — 구독', () => {
  it('연결 전에 건 구독은 CONNECTED 때 브로커에 걸리고 JSON 본문을 풀어 전달한다', () => {
    const c = createClient();
    const handler = vi.fn();
    c.client.subscribe('/topic/cranes', handler);
    c.client.connect();
    expect(c.transport.subscriptions.size).toBe(0);
    c.transport.simulateConnect();
    expect(c.transport.subscriptions.has('/topic/cranes')).toBe(true);
    c.transport.deliver('/topic/cranes', '{"type":"snapshot","cranes":[]}');
    expect(handler).toHaveBeenCalledWith({ type: 'snapshot', cranes: [] });
  });

  it('JSON 이 아닌 본문은 문자열 그대로 넘긴다', () => {
    const c = createClient();
    const handler = vi.fn();
    c.client.subscribe('/topic/raw', handler);
    c.client.connect();
    c.transport.simulateConnect();
    c.transport.deliver('/topic/raw', 'not json');
    expect(handler).toHaveBeenCalledWith('not json');
  });

  it('연결된 뒤에 건 구독은 바로 걸리고, 같은 목적지는 브로커 구독 하나를 나눠 쓴다', () => {
    const c = createClient();
    c.client.connect();
    c.transport.simulateConnect();
    const a = vi.fn();
    const b = vi.fn();
    c.client.subscribe('/topic/cranes', a);
    c.client.subscribe('/topic/cranes', b);
    expect(c.transport.subscriptions.size).toBe(1);
    c.transport.deliver('/topic/cranes', '1');
    expect(a).toHaveBeenCalledWith(1);
    expect(b).toHaveBeenCalledWith(1);
  });

  it('마지막 핸들러가 빠질 때만 브로커 구독을 끊고, 해제는 idempotent 다', () => {
    const c = createClient();
    c.client.connect();
    c.transport.simulateConnect();
    const offA = c.client.subscribe('/topic/cranes', vi.fn());
    const offB = c.client.subscribe('/topic/cranes', vi.fn());
    offA();
    expect(c.transport.unsubscribeLog).toEqual([]);
    offB();
    expect(c.transport.unsubscribeLog).toEqual(['/topic/cranes']);
    offB();
    expect(c.transport.unsubscribeLog).toEqual(['/topic/cranes']);
  });

  it('같은 핸들러 함수를 두 화면이 넘겨도 한 쪽이 빠진 뒤 브로커 구독이 남고, 메시지는 핸들러당 한 번이다', () => {
    // 모니터링 → 태그 전환: 브리지가 붙어 있는 채로 태그 페이지가 같은
    // applyBatch 로 구독하고, Canvas 안 브리지 정리는 그 뒤에 돈다.
    const c = createClient();
    c.client.connect();
    c.transport.simulateConnect();
    const applyBatch = vi.fn();
    const offBridge = c.client.subscribe('/topic/cranes', applyBatch);
    const offTags = c.client.subscribe('/topic/cranes', applyBatch);
    offBridge();
    expect(c.transport.unsubscribeLog).toEqual([]);
    c.transport.deliver('/topic/cranes', '1');
    expect(applyBatch).toHaveBeenCalledTimes(1);
    offTags();
    expect(c.transport.unsubscribeLog).toEqual(['/topic/cranes']);
  });

  it('같은 핸들러의 해제 함수를 두 번 불러도 다른 호출자의 등록은 빼지 않는다', () => {
    const c = createClient();
    c.client.connect();
    c.transport.simulateConnect();
    const applyBatch = vi.fn();
    const offA = c.client.subscribe('/topic/cranes', applyBatch);
    c.client.subscribe('/topic/cranes', applyBatch);
    offA();
    offA();
    expect(c.transport.unsubscribeLog).toEqual([]);
    c.transport.deliver('/topic/cranes', '1');
    expect(applyBatch).toHaveBeenCalledTimes(1);
  });

  it('끊겼다 다시 붙으면 남아 있는 구독만 전부 다시 건다', () => {
    const c = createClient();
    const handler = vi.fn();
    c.client.subscribe('/topic/cranes', handler);
    const offOther = c.client.subscribe('/topic/other', vi.fn());
    c.client.connect();
    c.transport.simulateConnect();
    offOther();
    c.transport.simulateClose();
    expect(c.transport.subscriptions.size).toBe(0);
    c.transport.simulateConnect();
    expect([...c.transport.subscriptions.keys()]).toEqual(['/topic/cranes']);
    c.transport.deliver('/topic/cranes', '{"ok":true}');
    expect(handler).toHaveBeenCalledWith({ ok: true });
  });

  it('끊긴 동안의 구독 해제는 브로커 unsubscribe 를 부르지 않는다(이미 버려진 구독)', () => {
    const c = createClient();
    const off = c.client.subscribe('/topic/cranes', vi.fn());
    c.client.connect();
    c.transport.simulateConnect();
    c.transport.simulateClose();
    off();
    expect(c.transport.unsubscribeLog).toEqual([]);
  });

  it('해제 직후 늦게 도착한 메시지는 조용히 버린다', () => {
    const c = createClient();
    const off = c.client.subscribe('/topic/cranes', vi.fn());
    c.client.connect();
    c.transport.simulateConnect();
    const entry = c.transport.subscriptions.get('/topic/cranes');
    off();
    expect(() => entry?.callback({ body: '{}' })).not.toThrow();
  });
});
