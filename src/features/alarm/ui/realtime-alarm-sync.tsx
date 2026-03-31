import { useEffect } from 'react';
import {
  isRealtimeAlarmMessage,
  shouldTrackRealtimeAlarmMessage,
  useRealtimeAlarmStore,
} from '../model/use-realtime-alarm-store';
import { alarmWebSocketClient } from '../model/alarm-websocket-client';

export function RealtimeAlarmSync() {
  useEffect(() => {
    const pushMessage = useRealtimeAlarmStore.getState().pushMessage;

    const unsubscribe = alarmWebSocketClient.subscribeAll((message) => {
      const data = message.payload;

      if (
        !isRealtimeAlarmMessage(data) ||
        !shouldTrackRealtimeAlarmMessage(data)
      ) {
        return;
      }

      pushMessage(data);
    });

    alarmWebSocketClient.connect();

    return () => {
      unsubscribe();
      alarmWebSocketClient.disconnect();
    };
  }, []);

  return null;
}
