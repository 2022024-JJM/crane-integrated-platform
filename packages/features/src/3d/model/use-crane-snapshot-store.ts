import { create } from 'zustand';
import {
  compareCraneIds,
  type CraneScope,
  type CraneSnapshot,
} from '@crane/domain/monitoring';
import {
  createCraneSnapshotEntry,
  mergeCraneSnapshot,
  type CraneSnapshotEntry,
} from '../lib/crane-snapshot-stats';

/** 범위(내업·외업) 하나의 피드 상태 — 화면은 자기 범위의 칸만 읽는다. */
export interface CraneFeedState {
  /** craneId → 스냅샷 + 관측치. 묶음이 올 때마다 바뀐 크레인 항목만 새 참조. */
  cranes: Record<string, CraneSnapshotEntry>;
  /** 정렬된 craneId 목록 — 새 크레인이 나타날 때만 바뀐다. */
  order: string[];
  /** 초기 REST 조회 실패. 구독은 계속 시도한다. */
  loadError: boolean;
  /** 마지막 묶음(REST·STOMP)을 받은 벽시계(ms). 아직이면 null — HUD 수신 줄. */
  lastReceivedAt: number | null;
}

interface CraneSnapshotState {
  byScope: Record<CraneScope, CraneFeedState>;
  applySnapshots: (
    scope: CraneScope,
    snapshots: CraneSnapshot[],
    receivedAt: number,
  ) => void;
  setLoadError: (scope: CraneScope, loadError: boolean) => void;
  clear: () => void;
}

/** 범위가 없는 화면(미등록 region)이 읽는 빈 칸 — 참조가 고정이다. */
export const EMPTY_CRANE_FEED: CraneFeedState = Object.freeze({
  cranes: {},
  order: [],
  loadError: false,
  lastReceivedAt: null,
}) as CraneFeedState;

function emptyByScope(): Record<CraneScope, CraneFeedState> {
  return { indoor: EMPTY_CRANE_FEED, outdoor: EMPTY_CRANE_FEED };
}

/** 범위의 칸. 범위가 null 이면 빈 칸(`EMPTY_CRANE_FEED`). */
export function selectCraneFeed(
  state: Pick<CraneSnapshotState, 'byScope'>,
  scope: CraneScope | null,
): CraneFeedState {
  return scope ? state.byScope[scope] : EMPTY_CRANE_FEED;
}

/**
 * 크레인 스냅샷 피드 — crane-integrated-server 의 `/api/{scope}/cranes` +
 * STOMP `/topic/{scope}/cranes` 를 받아 범위별로 크레인 현재 상태와 태그 변경
 * 통계를 든다. 두 범위는 크레인 ID 가 겹치지 않지만 화면마다 한 범위만 보므로
 * 칸을 나눈다 — 목록·수신 시각·조회 실패가 섞이지 않는다. 태그 페이지·3D 실시간
 * 브리지·에디터 크레인 칸이 읽는다. 구독·연결은 `useCraneSnapshotFeed` 가, 연결
 * 표시는 `useCraneFeedConnection` 이 맡는다. 연결이 끊겨도 값은 마지막 상태로 남는다.
 */
export const useCraneSnapshotStore = create<CraneSnapshotState>()(
  (set, get) => ({
    byScope: emptyByScope(),

    applySnapshots: (scope, snapshots, receivedAt) => {
      if (snapshots.length === 0) return;
      const feed = get().byScope[scope];
      const cranes = { ...feed.cranes };
      let added = false;
      for (const snapshot of snapshots) {
        // 같은 묶음에 같은 크레인이 두 번 오면 앞의 것 위에 합친다.
        const before = cranes[snapshot.craneId];
        if (before) {
          cranes[snapshot.craneId] = mergeCraneSnapshot(
            before,
            snapshot,
            receivedAt,
          );
        } else {
          cranes[snapshot.craneId] = createCraneSnapshotEntry(
            snapshot,
            receivedAt,
          );
          added = true;
        }
      }
      const next: CraneFeedState = {
        ...feed,
        cranes,
        order: added ? Object.keys(cranes).sort(compareCraneIds) : feed.order,
        lastReceivedAt: receivedAt,
      };
      set({ byScope: { ...get().byScope, [scope]: next } });
    },

    setLoadError: (scope, loadError) => {
      const feed = get().byScope[scope];
      if (feed.loadError === loadError) return;
      set({
        byScope: { ...get().byScope, [scope]: { ...feed, loadError } },
      });
    },
    clear: () => set({ byScope: emptyByScope() }),
  }),
);
