import { create } from 'zustand';
import type { SceneTransformMode } from './types';

const DEFAULT_SCENE_TRANSFORM_MODE: SceneTransformMode = 'translate';

interface SceneTransformModeState {
  mode: SceneTransformMode;
  setMode: (mode: SceneTransformMode) => void;
  resetMode: () => void;
}

export const useSceneTransformModeStore = create<SceneTransformModeState>()(
  (set) => ({
    mode: DEFAULT_SCENE_TRANSFORM_MODE,
    setMode: (mode) => set({ mode }),
    resetMode: () => set({ mode: DEFAULT_SCENE_TRANSFORM_MODE }),
  }),
);
