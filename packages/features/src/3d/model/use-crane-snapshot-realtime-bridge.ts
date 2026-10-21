import { useEffect } from 'react';
import { toTagNumber, type CraneSnapshot } from '@crane/domain/monitoring';
import { useCraneSnapshotFeed } from './use-crane-snapshot-feed';
import { useCraneSnapshotStore } from './use-crane-snapshot-store';
import { useRealtimeStore } from './use-realtime-store';

/**
 * 실시간 모드의 값 생산자 — 크레인 스냅샷 피드(`GET /api/cranes` + STOMP
 * `/topic/cranes`)를 켜고, 스토어에 새 스냅샷이 들어온 크레인의 태그 전부를
 * `useRealtimeStore` 버퍼에 쌓는다. 러너(`useRealtimeRunner`)가 매 프레임
 * 버퍼를 drain 해 태그 값 버스로 보낸다.
 *
 * - 키는 `${craneId}:${tagCode}` — 리플레이·가상 태그와 같은 키 공간이라
 *   씬의 태그 맵핑이 소스를 바꿔도 살아남는다.
 * - 바뀐 태그만이 아니라 스냅샷의 태그 **전부**를 쌓는다. 서버는 바뀐
 *   크레인만 묶음에 싣고 `heartbeat` 가 매초 뒤집히므로 살아 있는 크레인은
 *   매초 한 번은 온다. 같은 값의 재발행이 `tagLiveValues.at` 를 갱신해
 *   "정지 중" 과 "두절" 을 가른다(lib/model-runtime-status.ts) — 죽은
 *   크레인은 묶음에서 빠져 at 이 멈춘다.
 * - 켤 때와 보류(held) 해제 때는 스토어의 현재 스냅샷 전부를 한 번 쌓는다.
 *   진입 시 모델은 rest 자세이고, 보류 중 받은 값은 러너가 버리므로 그 뒤
 *   바뀌지 않은 태그는 다시 오지 않기 때문이다.
 *
 * 피드는 태그 페이지와 `craneStompClient` 를 참조 카운트로 나눠 쓴다. R3F
 * Canvas 안팎 어디서든 부를 수 있다(useEffect 만 쓴다).
 */
export function useCraneSnapshotRealtimeBridge(enabled: boolean) {
  useCraneSnapshotFeed(enabled);

  useEffect(() => {
    if (!enabled) return;

    pushAllSnapshots();
    const unsubscribeSnapshots = useCraneSnapshotStore.subscribe(
      (state, prev) => {
        if (state.cranes === prev.cranes) return;
        for (const [craneId, entry] of Object.entries(state.cranes)) {
          if (prev.cranes[craneId] !== entry) pushSnapshot(entry.snapshot);
        }
      },
    );
    const unsubscribeHold = useRealtimeStore.subscribe((state, prev) => {
      if (prev.held && !state.held) pushAllSnapshots();
    });

    return () => {
      unsubscribeSnapshots();
      unsubscribeHold();
    };
  }, [enabled]);
}

/** 스냅샷 한 대분의 태그를 버퍼에 쌓는다. 숫자로 못 바꾸는 값은 버린다. */
function pushSnapshot(snapshot: CraneSnapshot) {
  const push = useRealtimeStore.getState().pushValue;
  const craneId = snapshot.craneId.replace(/-/g, '_');
  for (const [code, tag] of Object.entries(snapshot.tags)) {
    const value = toTagNumber(tag.value);
    if (value === null) continue;
    push(`${craneId}:${code}`, value);
  }
}

function pushAllSnapshots() {
  const { cranes, order } = useCraneSnapshotStore.getState();
  for (const craneId of order) {
    const entry = cranes[craneId];
    if (entry) pushSnapshot(entry.snapshot);
  }
}
