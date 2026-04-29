import {
  getCranesLiteWebSocketUrl,
  getWebSocketBaseUrl,
  getWebSocketInitialIntervalMs,
  getWebSocketMaxIntervalMs,
  getWebSocketMaxReconnectAttempts,
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
      initialIntervalMs:
        options.reconnectPolicy?.initialIntervalMs ??
        options.reconnectPolicy?.intervalMs ??
        getWebSocketInitialIntervalMs(),
      maxIntervalMs:
        options.reconnectPolicy?.maxIntervalMs ?? getWebSocketMaxIntervalMs(),
      backoffMultiplier: options.reconnectPolicy?.backoffMultiplier,
      jitterRatio: options.reconnectPolicy?.jitterRatio,
      maxAttempts:
        options.reconnectPolicy?.maxAttempts ??
        getWebSocketMaxReconnectAttempts(),
    },
    socketFactory: options.socketFactory,
  });
}

export const webSocketClient = createWebSocketClient();

export const cranesLiteWebSocketClient = createWebSocketClient({
  url: getCranesLiteWebSocketUrl(),
  reconnectPolicy: {
    enabled: true,
    initialIntervalMs: 1_000,
    maxIntervalMs: 30_000,
    maxAttempts: Infinity,
  },
});
