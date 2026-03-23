import { create } from 'zustand';

interface SceneObjectSelectionState {
  selectedModelId: string | null;
  selectModel: (id: string) => void;
  clearSelectedModel: () => void;
}

export const useSceneObjectSelectionStore =
  create<SceneObjectSelectionState>()((set) => ({
    selectedModelId: null,
    selectModel: (id) => set({ selectedModelId: id }),
    clearSelectedModel: () => set({ selectedModelId: null }),
  }));
