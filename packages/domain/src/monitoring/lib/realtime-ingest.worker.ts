import {
  enqueueBounded,
  heartbeatCheckIntervalMs,
  INGEST_MAX_MESSAGES_PER_FLUSH,
  IngestBusyMeter,
  isStalled,
  parseIngestEnvelope,
  shouldForwardEnvelope,
  TagBatchCoalescer,
  type IngestCommand,
  type IngestConnectionState,
  type IngestEnvelope,
  type IngestEvent,
  type IngestReconnectPolicy,
} from './realtime-ingest-protocol';

/**
 * 실시간 수신 Worker — WebSocket 을 직접 열고, 메시지를 파싱해 태그는
 * 병합기(TagBatchCoalescer)에 모아 주기마다 배열로, 그 밖(알람 등)은 봉투
 * 그대로 메인에 보낸다. 재연결 백오프는 core 의 WebSocketClient 와 같은
 * 식이다(초기 간격 × 배수^시도, 상한, 지터).
 *
 * Worker 전역엔 `window` 가 없다 — 타이머는 전역 함수를 쓴다.
 */

const port = self as unknown as {
  postMessage: (message: IngestEvent, transfer?: Transferable[]) => void;
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<IngestCommand>) => void,
  ) => void;
};

const coalescer = new TagBatchCoalescer();
const busy = new IngestBusyMeter();
/** flush 까지 모아 두는 태그 아닌 봉투(알람 등). */
let pendingMessages: IngestEnvelope[] = [];
let socket: WebSocket | null = null;
let state: IngestConnectionState = 'idle';
let manualDisconnect = false;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastMessageAt = Number.NEGATIVE_INFINITY;
let connectOptions: Extract<IngestCommand, { t: 'connect' }> | null = null;

function emit(event: IngestEvent, transfer?: Transferable[]): void {
  port.postMessage(event, transfer);
}

function setState(next: IngestConnectionState): void {
  state = next;
  emit({ t: 'state', state: next });
}

function flush(): void {
  if (pendingMessages.length > 0) {
    const envelopes = pendingMessages;
    pendingMessages = [];
    emit({ t: 'messages', envelopes });
  }
  const batch = coalescer.flush();
  if (!batch) return;
  emit({ t: 'batch', ...batch, busyMs: busy.take() }, [
    batch.ids.buffer,
    batch.values.buffer,
  ]);
}

function startFlushTimer(flushMs: number): void {
  if (flushTimer !== null) return;
  flushTimer = setInterval(flush, flushMs);
}

function stopFlushTimer(): void {
  if (flushTimer === null) return;
  clearInterval(flushTimer);
  flushTimer = null;
  flush();
}

function startHeartbeat(heartbeatMs: number): void {
  stopHeartbeat();
  if (!(heartbeatMs > 0)) return;
  heartbeatTimer = setInterval(() => {
    if (state !== 'open' || !socket) return;
    if (!isStalled(lastMessageAt, Date.now(), heartbeatMs)) return;
    // 반쯤 죽은 연결 — close 이벤트가 오지 않으므로 우리가 끊는다. close
    // 핸들러가 재연결을 건다(manualDisconnect 가 아니므로).
    setState('stalled');
    socket.close();
  }, heartbeatCheckIntervalMs(heartbeatMs));
}

function stopHeartbeat(): void {
  if (heartbeatTimer === null) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function clearReconnectTimer(): void {
  if (reconnectTimer === null) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function reconnectDelayMs(
  policy: IngestReconnectPolicy,
  attempt: number,
): number {
  const exponential =
    policy.initialIntervalMs *
    Math.pow(policy.backoffMultiplier, Math.max(0, attempt));
  const capped = Math.min(policy.maxIntervalMs, exponential);
  if (policy.jitterRatio <= 0) return capped;
  return Math.max(
    0,
    capped * (1 + (Math.random() * 2 - 1) * policy.jitterRatio),
  );
}

function scheduleReconnect(): void {
  const options = connectOptions;
  if (!options || !options.reconnect.enabled) return;
  if (reconnectAttempts >= options.reconnect.maxAttempts) return;
  const delay = reconnectDelayMs(options.reconnect, reconnectAttempts);
  reconnectAttempts += 1;
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function detach(ws: WebSocket): void {
  ws.removeEventListener('open', onOpen);
  ws.removeEventListener('message', onMessage);
  ws.removeEventListener('close', onClose);
  ws.removeEventListener('error', onError);
}

function onOpen(): void {
  reconnectAttempts = 0;
  lastMessageAt = Date.now();
  setState('open');
}

function onMessage(event: MessageEvent<string>): void {
  lastMessageAt = Date.now();
  const started = busy.begin();
  // 관심 밖 크레인의 건별 태그는 원문만 보고 버린다 — 파싱이 비용의 대부분.
  if (
    typeof event.data === 'string' &&
    coalescer.dropRawIfOutsideInterest(event.data)
  ) {
    busy.end(started);
    return;
  }
  const envelope = parseIngestEnvelope(event.data);
  const consumed = coalescer.ingest(envelope.payload);
  if (!consumed && shouldForwardEnvelope(envelope)) {
    enqueueBounded(pendingMessages, envelope, INGEST_MAX_MESSAGES_PER_FLUSH);
  }
  busy.end(started);
}

function onClose(): void {
  if (socket) {
    detach(socket);
    socket = null;
  }
  setState('closed');
  if (!manualDisconnect) scheduleReconnect();
}

function onError(): void {
  setState('closed');
}

function connect(): void {
  const options = connectOptions;
  if (!options) return;
  if (state === 'connecting' || state === 'open') return;
  clearReconnectTimer();
  manualDisconnect = false;
  setState('connecting');
  socket = new WebSocket(options.url, options.protocols);
  socket.addEventListener('open', onOpen);
  socket.addEventListener('message', onMessage);
  socket.addEventListener('close', onClose);
  socket.addEventListener('error', onError);
  startFlushTimer(options.flushMs);
  startHeartbeat(options.heartbeatMs);
}

function disconnect(): void {
  manualDisconnect = true;
  clearReconnectTimer();
  stopFlushTimer();
  stopHeartbeat();
  if (!socket) {
    setState('closed');
    return;
  }
  setState('closing');
  detach(socket);
  socket.close();
  socket = null;
  setState('closed');
}

port.addEventListener('message', (event) => {
  const command = event.data;
  switch (command.t) {
    case 'connect':
      connectOptions = command;
      connect();
      break;
    case 'disconnect':
      disconnect();
      break;
    case 'interest':
      coalescer.setInterest(command.keys);
      break;
  }
});
