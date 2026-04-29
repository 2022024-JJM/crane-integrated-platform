import type { WebSocketReconnectPolicy } from './types';

export const DEFAULT_WEBSOCKET_RECONNECT_POLICY: Required<WebSocketReconnectPolicy> =
  {
    enabled: true,
    intervalMs: 1_000,
    initialIntervalMs: 1_000,
    maxIntervalMs: 30_000,
    backoffMultiplier: 2,
    jitterRatio: 0.2,
    maxAttempts: 5,
  };

export function normalizeReconnectPolicy(
  policy?: WebSocketReconnectPolicy,
): Required<WebSocketReconnectPolicy> {
  const initial =
    policy?.initialIntervalMs ??
    policy?.intervalMs ??
    DEFAULT_WEBSOCKET_RECONNECT_POLICY.initialIntervalMs;

  return {
    enabled: policy?.enabled ?? DEFAULT_WEBSOCKET_RECONNECT_POLICY.enabled,
    intervalMs: initial,
    initialIntervalMs: initial,
    maxIntervalMs:
      policy?.maxIntervalMs ?? DEFAULT_WEBSOCKET_RECONNECT_POLICY.maxIntervalMs,
    backoffMultiplier:
      policy?.backoffMultiplier ??
      DEFAULT_WEBSOCKET_RECONNECT_POLICY.backoffMultiplier,
    jitterRatio:
      policy?.jitterRatio ?? DEFAULT_WEBSOCKET_RECONNECT_POLICY.jitterRatio,
    maxAttempts:
      policy?.maxAttempts ?? DEFAULT_WEBSOCKET_RECONNECT_POLICY.maxAttempts,
  };
}

/**
 * 재연결 지연 시간 계산. attempt는 0-base.
 * delay = min(maxIntervalMs, initialIntervalMs * multiplier^attempt)
 * 이후 jitter 적용: delay *= 1 + (random * 2 - 1) * jitterRatio
 * cap을 먼저 적용해 Math.pow가 Infinity가 되어도 안전.
 */
export function computeReconnectDelayMs(
  policy: Required<WebSocketReconnectPolicy>,
  attempt: number,
): number {
  const safeAttempt = Math.max(0, attempt);
  const exponential =
    policy.initialIntervalMs * Math.pow(policy.backoffMultiplier, safeAttempt);
  const capped = Math.min(policy.maxIntervalMs, exponential);

  if (policy.jitterRatio <= 0) {
    return capped;
  }

  const jitterFactor = 1 + (Math.random() * 2 - 1) * policy.jitterRatio;
  return Math.max(0, capped * jitterFactor);
}
