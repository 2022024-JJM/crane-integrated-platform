import { useEffect, useSyncExternalStore } from 'react';
import {
  craneStompClient,
  type WebSocketConnectionState,
} from '@crane/core/ws';
import {
  getCraneSnapshots,
  isCraneSnapshotBatch,
  sanitizeCraneSnapshot,
  type CraneSnapshot,
} from '@crane/domain/monitoring';
import { useCraneSnapshotStore } from './use-crane-snapshot-store';

/** 서버의 전체 묶음 토픽. 크레인 하나짜리 `/topic/cranes/{id}` 는 쓰지 않는다. */
export const CRANE_SNAPSHOT_TOPIC = '/topic/cranes';

/**
 * 연결 표시 — 소켓 상태에 "누가 끊었나" 를 덧입힌 것.
 * - open / connecting: 소켓 그대로
 * - reconnecting: 서버 쪽에서 끊겨 stompjs 가 재연결을 기다리는 중
 * - off: 사용자가 끊었거나(연결 끊기 버튼) 아직 연결한 적이 없음
 */
export type CraneFeedConnection =
  | 'open'
  | 'connecting'
  | 'reconnecting'
  | 'off';

export function resolveCraneFeedConnection(
  socket: WebSocketConnectionState,
  active: boolean,
): CraneFeedConnection {
  if (socket === 'open') return 'open';
  if (socket === 'connecting') return 'connecting';
  return active ? 'reconnecting' : 'off';
}

function applyBatch(body: unknown) {
  if (!isCraneSnapshotBatch(body)) return;
  const snapshots: CraneSnapshot[] = [];
  for (const item of body.cranes) {
    const snapshot = sanitizeCraneSnapshot(item);
    if (snapshot) snapshots.push(snapshot);
  }
  useCraneSnapshotStore.getState().applySnapshots(snapshots, Date.now());
}

/**
 * 크레인 스냅샷 피드를 켠다 — 현재 상태를 REST 로 한 번 받고 STOMP 묶음을
 * 구독한다. `enabled` 가 false 면 구독을 풀고 연결 참조를 놓는다(마지막
 * 사용자였으면 소켓이 닫힌다). 값은 마지막 상태로 남는다.
 *
 * 다시 켜면 REST 를 다시 받는다 — 끊긴 동안 바뀐 값은 다음 push 묶음에
 * 바뀐 크레인만 실려 오므로 구독만으로는 따라잡지 못한다.
 *
 * R3F Canvas 밖(일반 React 컴포넌트)에서 호출한다.
 */
export function useCraneSnapshotFeed(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const unsubscribeTopic = craneStompClient.subscribe(
      CRANE_SNAPSHOT_TOPIC,
      applyBatch,
    );
    const release = craneStompClient.acquire();

    let cancelled = false;
    getCraneSnapshots().then(
      (snapshots) => {
        if (cancelled) return;
        const store = useCraneSnapshotStore.getState();
        store.setLoadError(false);
        store.applySnapshots(snapshots, Date.now());
      },
      () => {
        if (!cancelled) useCraneSnapshotStore.getState().setLoadError(true);
      },
    );

    return () => {
      cancelled = true;
      unsubscribeTopic();
      release();
    };
  }, [enabled]);
}

/** 피드가 붙는 브로커 주소 — 연결 설정 팝업의 호스트 표시용. */
export function getCraneFeedUrl() {
  return craneStompClient.getUrl();
}

function subscribeConnection(onChange: () => void) {
  return craneStompClient.subscribeState(() => onChange());
}

function readConnection(): CraneFeedConnection {
  return resolveCraneFeedConnection(
    craneStompClient.getState(),
    craneStompClient.isActive(),
  );
}

/**
 * 피드 연결 표시 — 클라이언트 상태를 useSyncExternalStore 로 읽는다(effect 안
 * setState 없이). 여러 화면이 같은 클라이언트를 나눠 써도 각자 맞는 값을 본다.
 */
export function useCraneFeedConnection(): CraneFeedConnection {
  return useSyncExternalStore(
    subscribeConnection,
    readConnection,
    readConnection,
  );
}
