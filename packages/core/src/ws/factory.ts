import {
  getWebSocketBaseUrl,
  getWebSocketMaxReconnectAttempts,
  getWebSocketReconnectIntervalMs,
} from '../config/network';
import { WebSocketClient } from './websocket-client';
import type { WebSocketClientOptions } from './types';

export function createWebSocketClient(
  options: Partial<WebSocketClientOptions> = {},
) {
  return new WebSocketClient({
    url: options.url ?? getWebSocketBaseUrl(),
    protocols: options.protocols,
    reconnectPolicy: {
      enabled: options.reconnectPolicy?.enabled ?? true,
      intervalMs:
        options.reconnectPolicy?.intervalMs ??
        getWebSocketReconnectIntervalMs(),
      maxAttempts:
        options.reconnectPolicy?.maxAttempts ??
        getWebSocketMaxReconnectAttempts(),
    },
    socketFactory: options.socketFactory,
  });
}

export const webSocketClient = createWebSocketClient();
