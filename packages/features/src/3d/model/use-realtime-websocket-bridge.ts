import { useEffect } from 'react';
import {
  isRealtimeCraneLiteMessage,
  toTagNumber,
} from '@crane/domain/monitoring';
import { cranesLiteWebSocketClient } from '@crane/core/ws';
import { useRealtimeStore } from './use-realtime-store';
import {
  recordRealtimeMessage,
  startRealtimeIngestStats,
} from './realtime-ingest-stats';

/**
 * 실시간 모드일 때 cranesLiteWebSocketClient를 구독하여
 * 수신된 크레인 값을 useRealtimeStore 버퍼에 push한다.
 *
 * 메시지는 태그 1건(RealtimeCraneLiteMessage) 또는 그 배열(배치)이다. 배열은
 * 서버가 주기마다 묶어 보내는 형식으로, 프레임 수를 줄이려는 부하 테스트용
 * 옵션이다 — 항목마다 같은 가드를 통과해야 한다.
 *
 * 키 포맷: `${craneId}:${tagCode}` (use-replay-player-store와 동일)
 * craneId는 '-'를 '_'로 정규화한다.
 *
 * 값은 `toTagNumber` 로 숫자로 맞춘다 — 상태 비트(boolean)는 0/1 로 들어가
 * 모델의 상태 태그(statusTags)가 읽는다. 숫자로 못 바꾸는 값만 버린다.
 *
 * 이 훅은 R3F Canvas 밖(일반 React 컴포넌트)에서 호출해야 한다.
 */
export function useRealtimeWebSocketBridge(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const stopStats = startRealtimeIngestStats();
    const store = useRealtimeStore.getState();

    const pushOne = (item: unknown): boolean => {
      if (!isRealtimeCraneLiteMessage(item)) return false;
      const value = toTagNumber(item.value);
      if (value === null) return false;
      const craneId = item.craneId.replace(/-/g, '_');
      store.pushValue(`${craneId}:${item.tagCode}`, value);
      return true;
    };

    const unsubscribe = cranesLiteWebSocketClient.subscribeAll((message) => {
      const t0 = performance.now();
      const payload = message.payload;
      let accepted = 0;
      let rejected = 0;
      if (Array.isArray(payload)) {
        for (const item of payload) {
          if (pushOne(item)) accepted += 1;
          else rejected += 1;
        }
      } else if (pushOne(payload)) {
        accepted = 1;
      } else {
        rejected = 1;
      }
      recordRealtimeMessage(accepted, rejected, performance.now() - t0);
    });

    const release = cranesLiteWebSocketClient.acquire();

    return () => {
      unsubscribe();
      release();
      stopStats();
    };
  }, [enabled]);
}
