import { useEffect } from 'react';
import { cranesLiteIngestClient } from '@crane/domain/monitoring';
import { useRealtimeStore } from './use-realtime-store';

/**
 * 실시간 모드일 때 수신 클라이언트(cranesLiteIngestClient)를 잡고, 배치로
 * 들어오는 태그 값을 useRealtimeStore 버퍼에 넣는다.
 *
 * 파싱·숫자 변환·키 조립·같은 키 병합은 전부 수신 Worker 가 끝내고 온다 —
 * 여기서는 키 사전으로 id 를 키로 바꿔 Map 에 넣는 것뿐이다. 키 포맷은
 * `${craneId}:${tagCode}`(craneId 의 `-` 는 `_`, use-replay-player-store 와
 * 동일).
 *
 * `interestKeys` 는 이 화면이 실제로 쓰는 태그 키(씬의 맵핑·상태 태그).
 * 주면 Worker 가 그 밖의 태그를 버려 메인 스레드가 받는 양이 서버 태그
 * 수에서 씬 태그 수로 준다. null/생략 = 전부 받기.
 *
 * 이 훅은 R3F Canvas 밖(일반 React 컴포넌트)에서 호출해야 한다.
 */
export function useRealtimeWebSocketBridge(
  enabled: boolean,
  interestKeys: readonly string[] | null = null,
) {
  useEffect(() => {
    if (!enabled) return;
    cranesLiteIngestClient.setInterestKeys(interestKeys);
    return () => {
      cranesLiteIngestClient.setInterestKeys(null);
    };
  }, [enabled, interestKeys]);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = cranesLiteIngestClient.subscribeTagBatch((batch) => {
      useRealtimeStore
        .getState()
        .pushBatch(batch.keys, batch.ids, batch.values, batch.count);
    });

    const release = cranesLiteIngestClient.acquire();

    return () => {
      unsubscribe();
      release();
    };
  }, [enabled]);
}
