import { useEffect } from 'react';
import { cranesLiteIngestClient } from '@crane/domain/monitoring';
import {
  isRealtimeAlarmMessage,
  shouldTrackRealtimeAlarmMessage,
  useRealtimeAlarmStore,
} from '../model/use-realtime-alarm-store';

/**
 * 서버 알람(alarm.changed) 을 알람 스토어로. 수신 클라이언트가 태그 메시지는
 * Worker 에서 걸러내고 그 밖의 봉투만 넘기므로, 앱 전역에 떠 있어도 메인
 * 스레드 비용은 알람 건수만큼이다.
 */
export function RealtimeAlarmSync() {
  useEffect(() => {
    const pushMessage = useRealtimeAlarmStore.getState().pushMessage;

    const unsubscribe = cranesLiteIngestClient.subscribeMessages((envelope) => {
      const data = envelope.payload;
      if (
        !isRealtimeAlarmMessage(data) ||
        !shouldTrackRealtimeAlarmMessage(data)
      ) {
        return;
      }
      pushMessage(data);
    });

    const release = cranesLiteIngestClient.acquire();

    return () => {
      unsubscribe();
      release();
    };
  }, []);

  return null;
}
