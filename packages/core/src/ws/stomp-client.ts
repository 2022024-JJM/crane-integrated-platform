import { Client, ReconnectionTimeMode } from '@stomp/stompjs';
import type { WebSocketConnectionState, WebSocketStateListener } from './types';

/**
 * STOMP 구독 핸들러 — 본문은 JSON 으로 풀어 넘긴다(JSON 이 아니면 문자열 그대로).
 */
export type StompMessageHandler<TBody = unknown> = (body: TBody) => void;

/**
 * 래퍼가 전송 계층에 기대는 최소 표면. 실제로는 `@stomp/stompjs` 의 `Client`
 * 이고, 테스트는 같은 모양의 가짜를 `clientFactory` 로 끼운다.
 */
export interface StompTransport {
  activate(): void;
  deactivate(): Promise<void>;
  subscribe(
    destination: string,
    callback: (message: { body: string }) => void,
  ): { unsubscribe(): void };
  readonly connected: boolean;
}

export interface StompTransportConfig {
  brokerURL: string;
  reconnectDelay: number;
  maxReconnectDelay: number;
  reconnectTimeMode: ReconnectionTimeMode;
  onConnect: () => void;
  onDisconnect: () => void;
  onWebSocketClose: () => void;
  onWebSocketError: () => void;
  onStompError: (frame: {
    headers: Record<string, string>;
    body: string;
  }) => void;
}

export interface StompClientOptions {
  /** STOMP 엔드포인트(ws:// · wss://). SockJS 없이 순수 WebSocket. */
  url: string;
  /** 끊긴 뒤 첫 재연결까지 대기(ms). 0 이면 재연결하지 않는다. */
  reconnectDelayMs?: number;
  /** 지수 백오프 상한(ms). */
  maxReconnectDelayMs?: number;
  clientFactory?: (config: StompTransportConfig) => StompTransport;
}

const DEFAULT_RECONNECT_DELAY_MS = 1_000;
const DEFAULT_MAX_RECONNECT_DELAY_MS = 30_000;

function defaultClientFactory(config: StompTransportConfig): StompTransport {
  return new Client(config);
}

function parseBody(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/**
 * `@stomp/stompjs` 를 `WebSocketClient` 와 같은 모양(acquire/release 참조
 * 카운트 · 상태 리스너 · 목적지별 구독)으로 감싼다.
 *
 * - 구독은 연결 전에 걸어도 된다 — 목적지별 핸들러 집합을 들고 있다가
 *   CONNECTED 프레임마다 다시 건다(stompjs 는 끊기면 구독을 버린다).
 * - 재연결은 stompjs 가 한다(`reconnectDelay`, 지수 백오프). 사용자가 끊은
 *   것(`disconnect`)과 서버 쪽에서 끊긴 것은 `isActive()` 로 가른다 — 끊겼는데
 *   active 면 재연결을 기다리는 중이다.
 * - 상태 값은 `WebSocketConnectionState` 를 그대로 쓴다. 같은 값은 다시
 *   알리지 않는다.
 */
export class StompClient {
  private readonly url: string;
  private readonly reconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;
  private readonly clientFactory: (
    config: StompTransportConfig,
  ) => StompTransport;
  private transport: StompTransport | null = null;
  private connectionState: WebSocketConnectionState = 'idle';
  private isManualDisconnect = false;
  private referenceCount = 0;
  private pendingReleaseScheduled = false;
  private readonly handlers = new Map<string, Set<StompMessageHandler>>();
  private readonly live = new Map<string, { unsubscribe(): void }>();
  private readonly stateListeners = new Set<WebSocketStateListener>();

  constructor(options: StompClientOptions) {
    this.url = options.url;
    this.reconnectDelayMs =
      options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
    this.maxReconnectDelayMs = Math.max(
      this.reconnectDelayMs,
      options.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS,
    );
    this.clientFactory = options.clientFactory ?? defaultClientFactory;
  }

  connect() {
    if (
      this.connectionState === 'connecting' ||
      this.connectionState === 'open'
    ) {
      return;
    }
    this.isManualDisconnect = false;
    this.setConnectionState('connecting');
    if (!this.transport) {
      this.transport = this.clientFactory({
        brokerURL: this.url,
        reconnectDelay: this.reconnectDelayMs,
        maxReconnectDelay: this.maxReconnectDelayMs,
        reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
        onConnect: this.handleConnect,
        onDisconnect: this.handleClose,
        onWebSocketClose: this.handleClose,
        onWebSocketError: this.handleError,
        onStompError: this.handleError,
      });
    }
    this.transport.activate();
  }

  /**
   * 참조 카운팅 연결 획득 — `WebSocketClient.acquire` 와 같은 계약. 첫
   * acquire 가 connect, 마지막 release 가 disconnect 이고, release 는
   * StrictMode 더블마운트 때문에 microtask 로 미룬다.
   */
  acquire(): () => void {
    this.referenceCount += 1;
    if (this.referenceCount === 1) {
      this.connect();
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.scheduleRelease();
    };
  }

  private scheduleRelease() {
    this.referenceCount = Math.max(0, this.referenceCount - 1);
    if (this.pendingReleaseScheduled) return;
    this.pendingReleaseScheduled = true;
    queueMicrotask(() => {
      this.pendingReleaseScheduled = false;
      if (this.referenceCount === 0) {
        this.disconnect();
      }
    });
  }

  disconnect() {
    this.isManualDisconnect = true;
    this.live.clear();
    if (this.transport) {
      void this.transport.deactivate();
    }
    this.setConnectionState('closed');
  }

  /**
   * 목적지 구독. 연결 전이면 보관했다가 연결되면 건다. 반환된 함수로 해제하며,
   * 같은 목적지의 마지막 핸들러가 빠지면 브로커 구독도 끊는다.
   */
  subscribe<TBody = unknown>(
    destination: string,
    handler: StompMessageHandler<TBody>,
  ): () => void {
    const set = this.handlers.get(destination) ?? new Set();
    set.add(handler as StompMessageHandler);
    this.handlers.set(destination, set);
    if (this.transport?.connected && !this.live.has(destination)) {
      this.attach(destination);
    }
    return () => {
      const current = this.handlers.get(destination);
      if (!current) return;
      current.delete(handler as StompMessageHandler);
      if (current.size > 0) return;
      this.handlers.delete(destination);
      const sub = this.live.get(destination);
      if (sub) {
        this.live.delete(destination);
        if (this.transport?.connected) sub.unsubscribe();
      }
    };
  }

  subscribeState(listener: WebSocketStateListener) {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  getState() {
    return this.connectionState;
  }

  /** 브로커 주소 — 연결 설정 팝업의 호스트 표시용. */
  getUrl() {
    return this.url;
  }

  /**
   * 연결돼 있거나, 끊겼지만 stompjs 가 재연결을 기다리는 중이면 true.
   * 사용자가 끊었거나(`disconnect`) 재연결이 꺼져 있으면 false.
   */
  isActive() {
    if (this.isManualDisconnect || this.connectionState === 'idle') {
      return false;
    }
    return this.connectionState === 'open' || this.reconnectDelayMs > 0;
  }

  private attach(destination: string) {
    if (!this.transport) return;
    const sub = this.transport.subscribe(destination, (message) => {
      const body = parseBody(message.body);
      const set = this.handlers.get(destination);
      if (!set) return;
      for (const handler of set) handler(body);
    });
    this.live.set(destination, sub);
  }

  private handleConnect = () => {
    this.live.clear();
    for (const destination of this.handlers.keys()) {
      this.attach(destination);
    }
    this.setConnectionState('open');
  };

  private handleClose = () => {
    this.live.clear();
    if (this.isManualDisconnect) {
      this.setConnectionState('closed');
      return;
    }
    // stompjs 가 reconnectDelay 뒤 다시 붙는다. 그동안은 closed 이고
    // isActive() 가 "재연결 대기" 를 알린다.
    this.setConnectionState('closed');
  };

  private handleError = () => {
    // 끊김은 뒤따르는 onWebSocketClose 가 처리한다. 열린 연결의 STOMP ERROR
    // 프레임은 브로커가 곧 연결을 닫으므로 역시 close 로 수렴한다.
  };

  private setConnectionState(state: WebSocketConnectionState) {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.stateListeners.forEach((listener) => {
      listener(state);
    });
  }
}
