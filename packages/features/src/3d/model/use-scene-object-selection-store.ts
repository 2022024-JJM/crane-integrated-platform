import { create } from 'zustand';

export type SelectedObjectType = 'model' | 'text';

interface SceneObjectSelectionState {
  selectedIds: Set<string>;
  /** Backward-compat: returns the single selected ID when exactly 1 is selected */
  selectedModelId: string | null;
  selectedObjectType: SelectedObjectType | null;
  selectModel: (id: string) => void;
  selectText: (id: string) => void;
  toggleModel: (id: string) => void;
  toggleText: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelectedModel: () => void;
}

function deriveCompat(ids: Set<string>, type: SelectedObjectType | null) {
  return {
    selectedIds: ids,
    selectedModelId: ids.size === 1 ? ids.values().next().value! : null,
    selectedObjectType: ids.size > 0 ? type : null,
  };
}

export const useSceneObjectSelectionStore = create<SceneObjectSelectionState>()(
  (set) => ({
    selectedIds: new Set<string>(),
    selectedModelId: null,
    selectedObjectType: null,

    selectModel: (id) =>
      set(deriveCompat(new Set([id]), 'model')),

    selectText: (id) =>
      set(deriveCompat(new Set([id]), 'text')),

    toggleModel: (id) =>
      set((state) => {
        const next = new Set(state.selectedIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return deriveCompat(next, next.size > 0 ? 'model' : null);
      }),

    toggleText: (id) =>
      set((state) => {
        const next = new Set(state.selectedIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return deriveCompat(next, next.size > 0 ? 'text' : null);
      }),

    selectAll: (ids) =>
      set(deriveCompat(new Set(ids), ids.length > 0 ? 'model' : null)),

    clearSelectedModel: () =>
      set(deriveCompat(new Set(), null)),
  }),
);
