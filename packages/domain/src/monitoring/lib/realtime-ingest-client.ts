import { getCranesLiteWebSocketUrl } from '@crane/core/config/network';
import { WebSocketClient } from '@crane/core/ws';
import {
  enqueueBounded,
  heartbeatCheckIntervalMs,
  INGEST_FLUSH_MS,
  INGEST_MAX_MESSAGES_PER_FLUSH,
  INGEST_HEARTBEAT_MS,
  IngestBusyMeter,
  isStalled,
  shouldForwardEnvelope,
  TagBatchCoalescer,
  type IngestCommand,
  type IngestConnectionState,
  type IngestEnvelope,
  type IngestEvent,
  type IngestReconnectPolicy,
} from './realtime-ingest-protocol';

/**
 * 실시간 수신 클라이언트(메인 스레드 쪽) — 소비자(3D 브리지·알람 동기화·
 * HUD 연결 상태)가 보는 단일 진입점. 실제 소켓과 파싱은 전송(transport)이
 * 맡는다.
 *
 * - WorkerTransport: 기본. `realtime-ingest.worker.ts` 를 띄워 메인 스레드는
 *   주기마다 배열 하나만 받는다.
 * - InlineTransport: Worker 가 없는 환경(테스트·SSR)의 폴백. core 의
 *   WebSocketClient 로 메인에서 받되 같은 병합기를 거쳐 **같은 배치 이벤트**
 *   를 낸다 — 소비자는 어느 전송인지 모른다.
 *
 * 소비자 API 는 세 갈래다. `subscribeTagBatch` 는 키 사전(id → 키)과 함께
 * 배치를 받고, `subscribeMessages` 는 태그가 아닌 봉투(알람)를, `subscribeState`
 * 는 연결 상태를 받는다. `setInterestKeys` 로 씬이 쓰는 키만 받도록 좁힌다.
 */

export interface TagBatch {
  /** id → 키. 배치마다 같은 배열 참조이며 뒤에 늘어나기만 한다. */
  keys: readonly string[];
  ids: Int32Array;
  values: Float64Array;
  count: number;
  received: number;
  dropped: number;
  busyMs: number;
}

export type TagBatchHandler = (batch: TagBatch) => void;
export type IngestMessageHandler = (envelope: IngestEnvelope) => void;
export type IngestStateListener = (state: IngestConnectionState) => void;

export interface IngestStats {
  /** 전송이 받은 태그 메시지 누계(관심 밖 포함). */
  receivedTotal: number;
  /** 관심 밖이라 전송 단계에서 버린 누계. */
  droppedTotal: number;
  /** 메인에 실제로 전달된 값 누계. */
  deliveredTotal: number;
  /** 배치 수신 누계. */
  batches: number;
  lastBatchAt: number;
  /** 전송 쪽(Worker)이 메시지 처리에 쓴 시간 누계(ms). */
  transportBusyMs: number;
  /** 최근 배치 구간의 전송 쪽 사용률(0~1) — busyMs ÷ 배치 간격. */
  transportBusyRatio: number;
}

export interface IngestTransport {
  start(options: Extract<IngestCommand, { t: 'connect' }>): void;
  stop(): void;
  setInterest(keys: string[] | null): void;
}

export type IngestTransportFactory = (
  onEvent: (event: IngestEvent) => void,
) => IngestTransport;

export interface RealtimeIngestClientOptions {
  url: string;
  protocols?: string | string[];
  reconnect: IngestReconnectPolicy;
  flushMs?: number;
  /** 무수신 감시(ms). 생략 = INGEST_HEARTBEAT_MS, 0 = 끄기. */
  heartbeatMs?: number;
  createTransport?: IngestTransportFactory;
}

/** Worker 가 죽은 뒤 다시 띄우기까지(ms) — 스크립트 오류 루프를 막는 간격. */
export const WORKER_RESTART_DELAY_MS = 1_000;

/**
 * Worker 전송 — 명령은 postMessage, 이벤트는 onmessage. Worker 가 던지면
 * (`error`·`messageerror`) 그 안의 소켓·감시 타이머가 모두 사라져 아무도 다시
 * 잇지 않으므로, 여기서 버리고 새로 띄워 마지막 연결 명령과 관심 키를 다시
 * 보낸다(24시간 무인).
 */
export function createWorkerTransport(
  onEvent: (event: IngestEvent) => void,
): IngestTransport {
  let worker: Worker | null = null;
  let lastConnect: Extract<IngestCommand, { t: 'connect' }> | null = null;
  let lastInterest: string[] | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  const post = (command: IngestCommand) => worker?.postMessage(command);

  const spawn = () => {
    const spawned = new Worker(
      new URL('./realtime-ingest.worker.ts', import.meta.url),
      { type: 'module' },
    );
    spawned.addEventListener('message', (event: MessageEvent<IngestEvent>) =>
      onEvent(event.data),
    );
    const onFailure = () => {
      if (worker !== spawned) return;
      spawned.terminate();
      worker = null;
      onEvent({ t: 'state', state: 'closed' });
      if (restartTimer !== null || !lastConnect) return;
      restartTimer = setTimeout(() => {
        restartTimer = null;
        if (!lastConnect) return;
        worker = spawn();
        post({ t: 'interest', keys: lastInterest });
        post(lastConnect);
      }, WORKER_RESTART_DELAY_MS);
    };
    spawned.addEventListener('error', onFailure);
    spawned.addEventListener('messageerror', onFailure);
    return spawned;
  };

  return {
    start(options) {
      lastConnect = options;
      if (!worker) worker = spawn();
      post(options);
    },
    stop() {
      lastConnect = null;
      if (restartTimer !== null) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      post({ t: 'disconnect' });
    },
    setInterest(keys) {
      lastInterest = keys;
      post({ t: 'interest', keys });
    },
  };
}

/** 인라인 전송 — 메인 스레드에서 core WebSocketClient 로 받아 같은 병합기를 돌린다. */
export function createInlineTransport(
  onEvent: (event: IngestEvent) => void,
  socketFactory?: (url: string, protocols?: string | string[]) => WebSocket,
): IngestTransport {
  const coalescer = new TagBatchCoalescer();
  const busy = new IngestBusyMeter();
  let pendingMessages: IngestEnvelope[] = [];
  let client: WebSocketClient | null = null;
  let unsubscribe: (() => void) | null = null;
  let unsubscribeState: (() => void) | null = null;
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let lastMessageAt = Number.NEGATIVE_INFINITY;

  const flush = () => {
    if (pendingMessages.length > 0) {
      const envelopes = pendingMessages;
      pendingMessages = [];
      onEvent({ t: 'messages', envelopes });
    }
    const batch = coalescer.flush();
    if (batch) onEvent({ t: 'batch', ...batch, busyMs: busy.take() });
  };

  return {
    start(options) {
      if (client) {
        client.connect();
        return;
      }
      client = new WebSocketClient({
        url: options.url,
        protocols: options.protocols,
        reconnectPolicy: options.reconnect,
        socketFactory,
      });
      unsubscribeState = client.subscribeState((state) => {
        if (state === 'open') lastMessageAt = Date.now();
        onEvent({ t: 'state', state });
      });
      unsubscribe = client.subscribeAll((message) => {
        lastMessageAt = Date.now();
        const started = busy.begin();
        const consumed = coalescer.ingest(message.payload);
        if (!consumed && shouldForwardEnvelope(message)) {
          enqueueBounded(
            pendingMessages,
            message,
            INGEST_MAX_MESSAGES_PER_FLUSH,
          );
        }
        busy.end(started);
      });
      flushTimer = setInterval(flush, options.flushMs);
      if (options.heartbeatMs > 0) {
        heartbeatTimer = setInterval(() => {
          if (!client || client.getState() !== 'open') return;
          if (!isStalled(lastMessageAt, Date.now(), options.heartbeatMs))
            return;
          onEvent({ t: 'state', state: 'stalled' });
          // 끊고 바로 다시 잇는다 — WebSocketClient 의 수동 disconnect 는
          // 재연결을 걸지 않으므로 직접 connect 한다.
          client.disconnect();
          client.connect();
        }, heartbeatCheckIntervalMs(options.heartbeatMs));
      }
      client.connect();
    },
    stop() {
      if (flushTimer !== null) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
      if (heartbeatTimer !== null) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      flush();
      unsubscribe?.();
      unsubscribe = null;
      // closed 상태 이벤트가 소비자에 닿도록 상태 구독은 끊은 뒤에 푼다.
      client?.disconnect();
      unsubscribeState?.();
      unsubscribeState = null;
      client = null;
    },
    setInterest(keys) {
      coalescer.setInterest(keys);
    },
  };
}

export function defaultIngestTransportFactory(
  onEvent: (event: IngestEvent) => void,
): IngestTransport {
  return typeof Worker === 'undefined'
    ? createInlineTransport(onEvent)
    : createWorkerTransport(onEvent);
}

export class RealtimeIngestClient {
  private readonly options: RealtimeIngestClientOptions;
  private transport: IngestTransport | null = null;
  private state: IngestConnectionState = 'idle';
  private referenceCount = 0;
  private pendingReleaseScheduled = false;
  private interest: string[] | null = null;
  private readonly keys: string[] = [];
  private readonly batchHandlers = new Set<TagBatchHandler>();
  private readonly messageHandlers = new Set<IngestMessageHandler>();
  private readonly stateListeners = new Set<IngestStateListener>();
  private readonly stats: IngestStats = {
    receivedTotal: 0,
    droppedTotal: 0,
    deliveredTotal: 0,
    batches: 0,
    lastBatchAt: Number.NEGATIVE_INFINITY,
    transportBusyMs: 0,
    transportBusyRatio: 0,
  };

  constructor(options: RealtimeIngestClientOptions) {
    this.options = options;
  }

  /**
   * 참조 카운팅 연결. 첫 acquire 가 전송을 시작하고 마지막 release 가 끊는다.
   * release 는 microtask 로 미뤄 StrictMode 더블 마운트에서 끊었다 잇지 않는다.
   */
  acquire(): () => void {
    this.referenceCount += 1;
    if (this.referenceCount === 1) this.connect();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.scheduleRelease();
    };
  }

  getState(): IngestConnectionState {
    return this.state;
  }

  subscribeState(listener: IngestStateListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  subscribeTagBatch(handler: TagBatchHandler): () => void {
    this.batchHandlers.add(handler);
    if (this.batchHandlers.size === 1) this.syncInterest();
    return () => {
      if (this.batchHandlers.delete(handler) && this.batchHandlers.size === 0) {
        this.syncInterest();
      }
    };
  }

  /**
   * 전송에 보내는 실제 관심 목록 — 배치 소비자(3D 브리지)가 없으면 빈 목록
   * (전부 버림). 알람 동기화만 떠 있는 화면(알람 이력 등)에서 소켓은 열려
   * 있어야 하지만 태그 수만 건이 메인까지 올 이유는 없다.
   */
  private effectiveInterest(): string[] | null {
    return this.batchHandlers.size === 0 ? [] : this.interest;
  }

  private syncInterest(): void {
    this.transport?.setInterest(this.effectiveInterest());
  }

  /** 태그가 아닌 봉투(알람 등). */
  subscribeMessages(handler: IngestMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * 전송이 메인으로 넘길 태그 키. null = 전부. 연결 전에 불러도 기억해 두고
   * 연결 때 보낸다. 배열은 복사해 둔다(호출자가 바꿔도 영향 없음).
   */
  setInterestKeys(keys: readonly string[] | null): void {
    this.interest = keys ? [...keys] : null;
    this.syncInterest();
  }

  getInterestKeys(): readonly string[] | null {
    return this.interest;
  }

  getStats(): Readonly<IngestStats> {
    return this.stats;
  }

  /** id → 키 사전(읽기 전용 뷰). */
  getKeys(): readonly string[] {
    return this.keys;
  }

  private connect(): void {
    if (!this.transport) {
      const factory =
        this.options.createTransport ?? defaultIngestTransportFactory;
      this.transport = factory((event) => this.handleEvent(event));
    }
    this.transport.setInterest(this.effectiveInterest());
    this.transport.start({
      t: 'connect',
      url: this.options.url,
      protocols: this.options.protocols,
      reconnect: this.options.reconnect,
      flushMs: this.options.flushMs ?? INGEST_FLUSH_MS,
      heartbeatMs: this.options.heartbeatMs ?? INGEST_HEARTBEAT_MS,
    });
  }

  private scheduleRelease(): void {
    this.referenceCount = Math.max(0, this.referenceCount - 1);
    if (this.pendingReleaseScheduled) return;
    this.pendingReleaseScheduled = true;
    queueMicrotask(() => {
      this.pendingReleaseScheduled = false;
      if (this.referenceCount === 0) this.transport?.stop();
    });
  }

  private handleEvent(event: IngestEvent): void {
    switch (event.t) {
      case 'state':
        this.state = event.state;
        for (const listener of this.stateListeners) listener(event.state);
        return;
      case 'message':
        for (const handler of this.messageHandlers) handler(event.envelope);
        return;
      case 'messages':
        // 한 task 안에서 전부 넘긴다 — React 가 스토어 set 들을 한 렌더로 묶는다.
        for (const envelope of event.envelopes) {
          for (const handler of this.messageHandlers) handler(envelope);
        }
        return;
      case 'batch': {
        if (event.newKeyIds && event.newKeys) {
          for (let i = 0; i < event.newKeyIds.length; i++) {
            this.keys[event.newKeyIds[i]!] = event.newKeys[i]!;
          }
        }
        this.stats.receivedTotal += event.received;
        this.stats.droppedTotal += event.dropped;
        this.stats.deliveredTotal += event.count;
        this.stats.batches += 1;
        const now = Date.now();
        const sinceLast = now - this.stats.lastBatchAt;
        this.stats.transportBusyMs += event.busyMs;
        this.stats.transportBusyRatio =
          Number.isFinite(sinceLast) && sinceLast > 0
            ? Math.min(1, event.busyMs / sinceLast)
            : 0;
        this.stats.lastBatchAt = now;
        if (event.count === 0) return;
        const batch: TagBatch = {
          keys: this.keys,
          ids: event.ids,
          values: event.values,
          count: event.count,
          received: event.received,
          dropped: event.dropped,
          busyMs: event.busyMs,
        };
        for (const handler of this.batchHandlers) handler(batch);
        return;
      }
    }
  }
}

/**
 * cranes-lite 실시간 수신 — 앱 전체가 공유하는 단일 클라이언트. 3D 브리지와
 * 알람 동기화가 각자 acquire 해 참조를 나눈다. 재연결은 무한(관제 24시간).
 */
export const cranesLiteIngestClient = new RealtimeIngestClient({
  url: getCranesLiteWebSocketUrl(),
  reconnect: {
    enabled: true,
    initialIntervalMs: 1_000,
    maxIntervalMs: 30_000,
    backoffMultiplier: 2,
    jitterRatio: 0.2,
    maxAttempts: Infinity,
  },
});
