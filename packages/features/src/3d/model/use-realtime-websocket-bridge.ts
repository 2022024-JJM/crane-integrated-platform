import { useEffect } from 'react';
import { isRealtimeCraneLiteMessage } from '@crane/domain/monitoring';
import { cranesLiteWebSocketClient } from '@crane/core/ws';
import { useRealtimeStore } from './use-realtime-store';

/**
 * 실시간 모드일 때 cranesLiteWebSocketClient를 구독하여
 * 수신된 크레인 값을 useRealtimeStore 버퍼에 push한다.
 *
 * 키 포맷: `${craneId}:${tagCode}` (use-replay-player-store와 동일)
 * craneId는 '-'를 '_'로 정규화한다.
 *
 * 이 훅은 R3F Canvas 밖(일반 React 컴포넌트)에서 호출해야 한다.
 */
export function useRealtimeWebSocketBridge(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = cranesLiteWebSocketClient.subscribeAll((message) => {
      const payload = message.payload;
      if (!isRealtimeCraneLiteMessage(payload)) return;
      if (typeof payload.value !== 'number') return;

      const craneId = payload.craneId.replace(/-/g, '_');
      const key = `${craneId}:${payload.tagCode}`;
      useRealtimeStore.getState().pushValue(key, payload.value);
    });

    cranesLiteWebSocketClient.connect();

    return () => {
      unsubscribe();
      cranesLiteWebSocketClient.disconnect();
    };
  }, [enabled]);
}
