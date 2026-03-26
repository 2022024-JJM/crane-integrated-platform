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

export type WebSocketStateListener = (
  state: WebSocketConnectionState,
) => void;

export interface WebSocketReconnectPolicy {
  enabled?: boolean;
  intervalMs: number;
  maxAttempts: number;
}

export interface WebSocketClientOptions {
  url: string;
  protocols?: string | string[];
  reconnectPolicy?: WebSocketReconnectPolicy;
  socketFactory?: (url: string, protocols?: string | string[]) => WebSocket;
}
