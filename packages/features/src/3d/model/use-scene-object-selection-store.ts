import { create } from 'zustand';

export type SelectedObjectType = 'model' | 'text';

interface SceneObjectSelectionState {
  selectedModelId: string | null;
  selectedObjectType: SelectedObjectType | null;
  selectModel: (id: string) => void;
  selectText: (id: string) => void;
  clearSelectedModel: () => void;
}

export const useSceneObjectSelectionStore = create<SceneObjectSelectionState>()(
  (set) => ({
    selectedModelId: null,
    selectedObjectType: null,
    selectModel: (id) =>
      set({ selectedModelId: id, selectedObjectType: 'model' }),
    selectText: (id) =>
      set({ selectedModelId: id, selectedObjectType: 'text' }),
    clearSelectedModel: () =>
      set({ selectedModelId: null, selectedObjectType: null }),
  }),
);
