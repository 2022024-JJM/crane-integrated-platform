import {
  getCranesLiteWebSocketUrl,
  getStompWebSocketUrl,
  getWebSocketBaseUrl,
  getWebSocketInitialIntervalMs,
  getWebSocketMaxIntervalMs,
  getWebSocketMaxReconnectAttempts,
} from '../config/network';
import { WebSocketClient } from './websocket-client';
import { StompClient, type StompClientOptions } from './stomp-client';
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

export function createStompClient(options: Partial<StompClientOptions> = {}) {
  return new StompClient({
    url: options.url ?? getStompWebSocketUrl(),
    reconnectDelayMs:
      options.reconnectDelayMs ?? getWebSocketInitialIntervalMs(),
    maxReconnectDelayMs:
      options.maxReconnectDelayMs ?? getWebSocketMaxIntervalMs(),
    clientFactory: options.clientFactory,
  });
}

/**
 * 크레인 스냅샷 서버(crane-integrated-server)의 STOMP 연결 — `/topic/cranes`
 * (전체 묶음) · `/topic/cranes/{craneId}`. 화면들이 acquire/release 로
 * 나눠 쓴다.
 */
export const craneStompClient = createStompClient();
