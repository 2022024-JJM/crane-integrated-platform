import { createWebSocketClient } from '@crane/core/ws';
import { getCranesLiteWebSocketUrl } from '@crane/core/config/network';

export const alarmWebSocketClient = createWebSocketClient({
  url: getCranesLiteWebSocketUrl(),
  reconnectPolicy: {
    enabled: true,
    intervalMs: undefined,
    maxAttempts: Infinity,
  },
});
