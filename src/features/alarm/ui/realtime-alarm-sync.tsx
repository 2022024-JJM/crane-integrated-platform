import { useEffect, useRef } from 'react';
import {
  getCranesLiteWebSocketUrl,
  getWebSocketReconnectIntervalMs,
} from '@/shared/config/network';
import {
  isRealtimeAlarmMessage,
  shouldTrackRealtimeAlarmMessage,
  useRealtimeAlarmStore,
} from '../model/use-realtime-alarm-store';

export function RealtimeAlarmSync() {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(true);

  useEffect(() => {
    const pushMessage = useRealtimeAlarmStore.getState().pushMessage;
    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current === null) {
        return;
      }

      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    };

    const connect = () => {
      const wsAlarm = new WebSocket(getCranesLiteWebSocketUrl());
      socketRef.current = wsAlarm;

      wsAlarm.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as unknown;

          if (
            !isRealtimeAlarmMessage(data) ||
            !shouldTrackRealtimeAlarmMessage(data)
          ) {
            return;
          }

          pushMessage(data);
        } catch (error) {
          console.error('[ALARM WS] failed to parse message', error, event.data);
        }
      };

      wsAlarm.onclose = () => {
        socketRef.current = null;

        if (!shouldReconnectRef.current) {
          return;
        }

        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, getWebSocketReconnectIntervalMs());
      };

      wsAlarm.onerror = () => {
        if (wsAlarm.readyState === WebSocket.CONNECTING) {
          return;
        }

        console.error('[ALARM WS] error');
      };
    };

    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      clearReconnectTimer();

      if (socketRef.current) {
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onopen = null;
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  return null;
}
