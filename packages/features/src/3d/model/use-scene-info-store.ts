import { create } from 'zustand';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { MonitoringViewMode } from './types';

interface SceneInfoState {
  sceneInfoByRegion: Record<string, SavedSceneInfo>;
  /**
   * 지금 떠 있는 모니터링 화면의 종류(useSceneData 가 진입에 set, 이탈에
   * null). 저널·로컬 알람·경보 소리 브릿지가 "실시간 화면의 사건인가" 를
   * 판정하는 근거다 — 플레이백·에디터·미리보기의 충돌·침범·두절은 대시보드
   * 통계에 섞이면 안 된다. 언마운트 cleanup 순서(부모 먼저)에 기대지 않도록
   * 브릿지는 진입 사건만 이 값으로 받고 이탈은 승인된 쌍만 받는다.
   */
  activeMode: MonitoringViewMode | null;
  setSceneInfo: (regionId: string, info: SavedSceneInfo) => void;
  clearSceneInfo: (regionId: string) => void;
  setActiveMode: (mode: MonitoringViewMode | null) => void;
}

export const useSceneInfoStore = create<SceneInfoState>()((set, get) => ({
  sceneInfoByRegion: {},
  activeMode: null,
  setSceneInfo: (regionId, info) =>
    set((state) => ({
      sceneInfoByRegion: { ...state.sceneInfoByRegion, [regionId]: info },
    })),
  clearSceneInfo: (regionId) =>
    set((state) => {
      const next = { ...state.sceneInfoByRegion };
      delete next[regionId];
      return { sceneInfoByRegion: next };
    }),
  setActiveMode: (mode) => {
    if (mode === get().activeMode) return;
    set({ activeMode: mode });
  },
}));

/** 실시간 모니터링 화면이 떠 있는가 — 브릿지의 진입 사건 게이트. */
export function isRealtimeSceneActive(): boolean {
  return useSceneInfoStore.getState().activeMode === 'realtime';
}
