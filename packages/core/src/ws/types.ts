export type WebSocketConnectionState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closing'
  | 'closed';

export interface WebSocketMessageEnvelope<TPayload = unknown> {
  type: string;
  payload: TPayload;
  timestamp?: string;
  requestId?: string;
}

export type WebSocketMessageHandler<TPayload = unknown> = (
  message: WebSocketMessageEnvelope<TPayload>,
) => void;

export type WebSocketStateListener = (state: WebSocketConnectionState) => void;

export interface WebSocketReconnectPolicy {
  enabled?: boolean;
  /**
   * @deprecated `initialIntervalMs` 사용 권장. 명시 시 `initialIntervalMs`로 alias.
   */
  intervalMs?: number;
  /** 첫 재시도 전 대기 시간(ms). */
  initialIntervalMs?: number;
  /** 백오프 상한(ms). delay가 이 값을 넘지 않도록 cap. */
  maxIntervalMs?: number;
  /** 지수 인자. delay = initial * multiplier^attempt. */
  backoffMultiplier?: number;
  /** 0~1, 적용 jitter 비율. delay *= 1 ± random*ratio. */
  jitterRatio?: number;
  maxAttempts?: number;
}

export interface WebSocketClientOptions {
  url: string;
  protocols?: string | string[];
  reconnectPolicy?: WebSocketReconnectPolicy;
  socketFactory?: (url: string, protocols?: string | string[]) => WebSocket;
}
