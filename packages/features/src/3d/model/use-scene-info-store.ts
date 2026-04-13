import { create } from 'zustand';
import type { SavedSceneInfo } from '@crane/domain/3d';

interface SceneInfoState {
  sceneInfoByRegion: Record<string, SavedSceneInfo>;
  setSceneInfo: (regionId: string, info: SavedSceneInfo) => void;
  clearSceneInfo: (regionId: string) => void;
}

export const useSceneInfoStore = create<SceneInfoState>()((set) => ({
  sceneInfoByRegion: {},
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
}));
