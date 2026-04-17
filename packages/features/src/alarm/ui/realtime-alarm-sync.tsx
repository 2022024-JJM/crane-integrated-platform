import { useEffect } from 'react';
import {
  isRealtimeAlarmMessage,
  shouldTrackRealtimeAlarmMessage,
  useRealtimeAlarmStore,
} from '../model/use-realtime-alarm-store';
import { cranesLiteWebSocketClient } from '@crane/core/ws';

export function RealtimeAlarmSync() {
  useEffect(() => {
    const pushMessage = useRealtimeAlarmStore.getState().pushMessage;

    const unsubscribe = cranesLiteWebSocketClient.subscribeAll((message) => {
      const data = message.payload;

      if (
        !isRealtimeAlarmMessage(data) ||
        !shouldTrackRealtimeAlarmMessage(data)
      ) {
        return;
      }

      pushMessage(data);
    });

    cranesLiteWebSocketClient.connect();

    return () => {
      unsubscribe();
      cranesLiteWebSocketClient.disconnect();
    };
  }, []);

  return null;
}
