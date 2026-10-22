import { create } from 'zustand';
import { compareCraneIds, type CraneSnapshot } from '@crane/domain/monitoring';
import {
  createCraneSnapshotEntry,
  mergeCraneSnapshot,
  type CraneSnapshotEntry,
} from '../lib/crane-snapshot-stats';

interface CraneSnapshotState {
  /** craneId → 스냅샷 + 관측치. 묶음이 올 때마다 바뀐 크레인 항목만 새 참조. */
  cranes: Record<string, CraneSnapshotEntry>;
  /** 정렬된 craneId 목록 — 새 크레인이 나타날 때만 바뀐다. */
  order: string[];
  /** 초기 REST 조회 실패. 구독은 계속 시도한다. */
  loadError: boolean;
  /** 마지막 묶음(REST·STOMP)을 받은 벽시계(ms). 아직이면 null — HUD 수신 줄. */
  lastReceivedAt: number | null;
  applySnapshots: (snapshots: CraneSnapshot[], receivedAt: number) => void;
  setLoadError: (loadError: boolean) => void;
  clear: () => void;
}

/**
 * 크레인 스냅샷 피드 — crane-integrated-server 의 `/api/cranes` + STOMP
 * `/topic/cranes` 를 받아 크레인별 현재 상태와 태그 변경 통계를 든다.
 * 태그 페이지(실시간 탭)가 읽고, 3D 모델 맵핑도 여기서 값을 꺼내 버스로
 * 보내게 된다. 구독·연결은 `useCraneSnapshotFeed` 가, 연결 표시는
 * `useCraneFeedConnection` 이 맡는다. 연결이 끊겨도 값은 마지막 상태로 남는다.
 */
export const useCraneSnapshotStore = create<CraneSnapshotState>()(
  (set, get) => ({
    cranes: {},
    order: [],
    loadError: false,
    lastReceivedAt: null,

    applySnapshots: (snapshots, receivedAt) => {
      if (snapshots.length === 0) return;
      const cranes = { ...get().cranes };
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
      set(
        added
          ? {
              cranes,
              order: Object.keys(cranes).sort(compareCraneIds),
              lastReceivedAt: receivedAt,
            }
          : { cranes, lastReceivedAt: receivedAt },
      );
    },

    setLoadError: (loadError) => {
      if (get().loadError !== loadError) set({ loadError });
    },
    clear: () =>
      set({ cranes: {}, order: [], loadError: false, lastReceivedAt: null }),
  }),
);
