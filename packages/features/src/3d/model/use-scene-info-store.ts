import { create } from 'zustand';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { MonitoringViewMode } from './types';

interface SceneInfoState {
  sceneInfoByRegion: Record<string, SavedSceneInfo>;
  /**
   * 지금 떠 있는 모니터링 화면의 종류(useSceneData 가 진입에 set, 이탈에
   * null). 저널·로컬 알람·경보 소리 브릿지가 "실시간 화면의 사건인가" 를
   * 판정하는 근거다 — 3D 플레이·에디터·미리보기의 충돌·침범·두절은 대시보드
   * 통계에 섞이면 안 된다. 언마운트 cleanup 순서(부모 먼저)에 기대지 않도록
   * 브릿지는 진입 사건만 이 값으로 받고 이탈은 승인된 쌍만 받는다.
   */
  activeMode: MonitoringViewMode | null;
  /**
   * 지금 떠 있는 모니터링 화면의 region(useSceneData 가 진입에 set, 이탈에
   * null). 사건(충돌·침범)의 모델 id → region 역조회가 이 값을 우선한다 —
   * 한 씬 파일을 공유하는 region 들(옥포 dock-1·dock-2)은 같은 모델 id 를
   * 가지므로 `sceneInfoByRegion` 순회만으로는 어느 화면의 사건인지 알 수 없다.
   */
  activeRegionId: string | null;
  setSceneInfo: (regionId: string, info: SavedSceneInfo) => void;
  clearSceneInfo: (regionId: string) => void;
  setActiveMode: (mode: MonitoringViewMode | null) => void;
  setActiveRegionId: (regionId: string | null) => void;
}

export const useSceneInfoStore = create<SceneInfoState>()((set, get) => ({
  sceneInfoByRegion: {},
  activeMode: null,
  activeRegionId: null,
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
  setActiveRegionId: (regionId) => {
    if (regionId === get().activeRegionId) return;
    set({ activeRegionId: regionId });
  },
}));

/** 실시간·플레이 화면이 떠 있는 region — 사건의 region 귀속에 우선한다. */
export function getActiveSceneRegionId(): string | null {
  return useSceneInfoStore.getState().activeRegionId;
}

/** 실시간 모니터링 화면이 떠 있는가 — 브릿지의 진입 사건 게이트. */
export function isRealtimeSceneActive(): boolean {
  return useSceneInfoStore.getState().activeMode === 'realtime';
}
