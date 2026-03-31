import { createWebSocketClient } from '@/shared/ws';
import { getCranesLiteWebSocketUrl } from '@/shared/config/network';

export const alarmWebSocketClient = createWebSocketClient({
  url: getCranesLiteWebSocketUrl(),
  reconnectPolicy: {
    enabled: true,
    intervalMs: undefined,
    maxAttempts: Infinity,
  },
});
