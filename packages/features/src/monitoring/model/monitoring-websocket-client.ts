import { getCranesLiteWebSocketUrl } from '@crane/core/config/network';
import { createWebSocketClient } from '@crane/core/ws';

export const monitoringWebSocketClient = createWebSocketClient({
  url: getCranesLiteWebSocketUrl(),
  reconnectPolicy: {
    enabled: true,
    intervalMs: 5_000,
    maxAttempts: Infinity,
  },
});
