import type { WebSocketReconnectPolicy } from './types';

export const DEFAULT_WEBSOCKET_RECONNECT_POLICY: Required<WebSocketReconnectPolicy> =
  {
    enabled: true,
    intervalMs: 3_000,
    maxAttempts: 5,
  };

export function normalizeReconnectPolicy(
  policy?: WebSocketReconnectPolicy,
): Required<WebSocketReconnectPolicy> {
  return {
    enabled: policy?.enabled ?? DEFAULT_WEBSOCKET_RECONNECT_POLICY.enabled,
    intervalMs:
      policy?.intervalMs ?? DEFAULT_WEBSOCKET_RECONNECT_POLICY.intervalMs,
    maxAttempts:
      policy?.maxAttempts ?? DEFAULT_WEBSOCKET_RECONNECT_POLICY.maxAttempts,
  };
}
