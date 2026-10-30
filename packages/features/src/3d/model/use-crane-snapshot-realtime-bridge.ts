import { useEffect } from 'react';
import {
  buildCraneTagKey,
  toTagNumber,
  type CraneScope,
  type CraneSnapshot,
} from '@crane/domain/monitoring';
import { useCraneSnapshotFeed } from './use-crane-snapshot-feed';
import { useCraneSnapshotStore } from './use-crane-snapshot-store';
import { useRealtimeStore } from './use-realtime-store';

/**
 * 실시간 모드의 값 생산자 — 범위의 크레인 스냅샷 피드(`GET /api/{scope}/cranes`
 * + STOMP `/topic/{scope}/cranes`)를 켜고, 스토어의 그 범위 칸에 새 스냅샷이
 * 들어온 크레인의 태그 전부를 `useRealtimeStore` 버퍼에 쌓는다. 러너
 * (`useRealtimeRunner`)가 매 프레임 버퍼를 drain 해 태그 값 버스로 보낸다.
 * `scope` 가 null 이면(실시간 모드가 아니거나 미등록 region) 꺼져 있다.
 *
 * - 키는 `${craneId}.${tagCode}`(`buildCraneTagKey`) — 리플레이와 같은 키 공간이라
 *   씬의 태그 맵핑이 소스를 바꿔도 살아남는다.
 * - 바뀐 태그만이 아니라 스냅샷의 태그 **전부**를 쌓는다. 서버는 바뀐
 *   크레인만 묶음에 싣고 `heartbeat` 가 매초 뒤집히므로 살아 있는 크레인은
 *   매초 한 번은 온다. 같은 값의 재발행이 `tagLiveValues.at` 를 갱신해
 *   "정지 중" 과 "두절" 을 가른다(lib/model-runtime-status.ts) — 죽은
 *   크레인은 묶음에서 빠져 at 이 멈춘다.
 * - 값 없음(null)은 null 로 쌓는다 — 러너가 `publishTagNull` 로 내보내 라벨이
 *   마지막 숫자 대신 `NULL` 을 보인다. 숫자로 못 바꾸는 그 밖의 값은 버린다.
 * - 켤 때와 보류(held) 해제 때는 스토어의 현재 스냅샷 전부를 한 번 쌓는다.
 *   진입 시 모델은 rest 자세이고, 보류 중 받은 값은 러너가 버리므로 그 뒤
 *   바뀌지 않은 태그는 다시 오지 않기 때문이다.
 *
 * 피드는 태그 페이지와 `craneStompClient` 를 참조 카운트로 나눠 쓴다. R3F
 * Canvas 안팎 어디서든 부를 수 있다(useEffect 만 쓴다).
 */
export function useCraneSnapshotRealtimeBridge(scope: CraneScope | null) {
  useCraneSnapshotFeed(scope);

  useEffect(() => {
    if (!scope) return;

    pushAllSnapshots(scope);
    const unsubscribeSnapshots = useCraneSnapshotStore.subscribe(
      (state, prev) => {
        const cranes = state.byScope[scope].cranes;
        const before = prev.byScope[scope].cranes;
        if (cranes === before) return;
        for (const [craneId, entry] of Object.entries(cranes)) {
          if (before[craneId] !== entry) pushSnapshot(entry.snapshot);
        }
      },
    );
    const unsubscribeHold = useRealtimeStore.subscribe((state, prev) => {
      if (prev.held && !state.held) pushAllSnapshots(scope);
    });

    return () => {
      unsubscribeSnapshots();
      unsubscribeHold();
    };
  }, [scope]);
}

/** 스냅샷 한 대분의 태그를 버퍼에 쌓는다. null 은 null 로, 숫자로 못 바꾸는 값은 버린다. */
function pushSnapshot(snapshot: CraneSnapshot) {
  const push = useRealtimeStore.getState().pushValue;
  for (const [code, tag] of Object.entries(snapshot.tags)) {
    const value = tag.value === null ? null : toTagNumber(tag.value);
    if (value === null && tag.value !== null) continue;
    push(buildCraneTagKey(snapshot.craneId, code), value);
  }
}

function pushAllSnapshots(scope: CraneScope) {
  const { cranes, order } = useCraneSnapshotStore.getState().byScope[scope];
  for (const craneId of order) {
    const entry = cranes[craneId];
    if (entry) pushSnapshot(entry.snapshot);
  }
}
