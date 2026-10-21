import {
  getStompWebSocketUrl,
  getWebSocketInitialIntervalMs,
  getWebSocketMaxIntervalMs,
} from '../config/network';
import { StompClient, type StompClientOptions } from './stomp-client';

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
