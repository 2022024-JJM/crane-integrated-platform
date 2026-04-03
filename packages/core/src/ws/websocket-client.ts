import { normalizeReconnectPolicy } from './reconnect-policy';
import type {
  WebSocketClientOptions,
  WebSocketConnectionState,
  WebSocketMessageEnvelope,
  WebSocketMessageHandler,
  WebSocketStateListener,
} from './types';

const ALL_MESSAGES_KEY = '*';

function isEnvelope(value: unknown): value is WebSocketMessageEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string' &&
    'payload' in value
  );
}

function createEnvelope(value: unknown): WebSocketMessageEnvelope {
  if (isEnvelope(value)) {
    return value;
  }

  return {
    type: 'unknown',
    payload: value,
  };
}

export class WebSocketClient {
  private readonly url: string;
  private readonly protocols: string | string[] | undefined;
  private readonly reconnectPolicy: ReturnType<typeof normalizeReconnectPolicy>;
  private readonly socketFactory: NonNullable<WebSocketClientOptions['socketFactory']>;
  private socket: WebSocket | null = null;
  private connectionState: WebSocketConnectionState = 'idle';
  private reconnectAttempts = 0;
  private reconnectTimeoutId: number | null = null;
  private isManualDisconnect = false;
  private readonly messageHandlers = new Map<
    string,
    Set<WebSocketMessageHandler>
  >();
  private readonly stateListeners = new Set<WebSocketStateListener>();

  constructor(options: WebSocketClientOptions) {
    this.url = options.url;
    this.protocols = options.protocols;
    this.reconnectPolicy = normalizeReconnectPolicy(options.reconnectPolicy);
    this.socketFactory =
      options.socketFactory ?? ((url, protocols) => new WebSocket(url, protocols));
  }

  connect() {
    if (
      this.connectionState === 'connecting' ||
      this.connectionState === 'open'
    ) {
      return;
    }

    this.clearReconnectTimeout();
    this.isManualDisconnect = false;
    this.setConnectionState('connecting');
    this.socket = this.socketFactory(this.url, this.protocols);

    this.socket.addEventListener('open', this.handleOpen);
    this.socket.addEventListener('message', this.handleMessage);
    this.socket.addEventListener('close', this.handleClose);
    this.socket.addEventListener('error', this.handleError);
  }

  disconnect() {
    this.isManualDisconnect = true;
    this.clearReconnectTimeout();

    if (!this.socket) {
      this.setConnectionState('closed');
      return;
    }

    this.setConnectionState('closing');
    this.detachSocketListeners(this.socket);
    this.socket.close();
    this.socket = null;
    this.setConnectionState('closed');
  }

  send(payload: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (!this.socket || this.connectionState !== 'open') {
      throw new Error('WebSocket connection is not open.');
    }

    this.socket.send(payload);
  }

  sendJson(message: WebSocketMessageEnvelope) {
    this.send(JSON.stringify(message));
  }

  subscribe<TPayload = unknown>(
    type: string,
    handler: WebSocketMessageHandler<TPayload>,
  ) {
    const handlers = this.messageHandlers.get(type) ?? new Set();
    handlers.add(handler as WebSocketMessageHandler);
    this.messageHandlers.set(type, handlers);

    return () => {
      this.unsubscribe(type, handler);
    };
  }

  subscribeAll<TPayload = unknown>(handler: WebSocketMessageHandler<TPayload>) {
    return this.subscribe(ALL_MESSAGES_KEY, handler);
  }

  unsubscribe<TPayload = unknown>(
    type: string,
    handler: WebSocketMessageHandler<TPayload>,
  ) {
    const handlers = this.messageHandlers.get(type);
    if (!handlers) {
      return;
    }

    handlers.delete(handler as WebSocketMessageHandler);

    if (handlers.size === 0) {
      this.messageHandlers.delete(type);
    }
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

  private handleOpen = () => {
    this.reconnectAttempts = 0;
    this.setConnectionState('open');
  };

  private handleMessage = (event: MessageEvent<string>) => {
    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(event.data);
    } catch {
      parsedPayload = event.data;
    }

    const message = createEnvelope(parsedPayload);
    const scopedHandlers = this.messageHandlers.get(message.type) ?? new Set();
    const globalHandlers = this.messageHandlers.get(ALL_MESSAGES_KEY) ?? new Set();

    [...scopedHandlers, ...globalHandlers].forEach((handler) => {
      handler(message);
    });
  };

  private handleClose = () => {
    this.detachCurrentSocket();
    this.setConnectionState('closed');

    if (!this.isManualDisconnect) {
      this.scheduleReconnect();
    }
  };

  private handleError = () => {
    this.setConnectionState('closed');
  };

  private setConnectionState(state: WebSocketConnectionState) {
    this.connectionState = state;
    this.stateListeners.forEach((listener) => {
      listener(state);
    });
  }

  private scheduleReconnect() {
    if (!this.reconnectPolicy.enabled) {
      return;
    }

    if (this.reconnectAttempts >= this.reconnectPolicy.maxAttempts) {
      return;
    }

    this.reconnectAttempts += 1;
    this.clearReconnectTimeout();
    this.reconnectTimeoutId = window.setTimeout(() => {
      this.connect();
    }, this.reconnectPolicy.intervalMs);
  }

  private clearReconnectTimeout() {
    if (this.reconnectTimeoutId !== null) {
      window.clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  private detachCurrentSocket() {
    if (!this.socket) {
      return;
    }

    this.detachSocketListeners(this.socket);
    this.socket = null;
  }

  private detachSocketListeners(socket: WebSocket) {
    socket.removeEventListener('open', this.handleOpen);
    socket.removeEventListener('message', this.handleMessage);
    socket.removeEventListener('close', this.handleClose);
    socket.removeEventListener('error', this.handleError);
  }
}
