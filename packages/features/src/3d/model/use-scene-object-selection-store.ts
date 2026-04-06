import { create } from 'zustand';

export type SelectedObjectType = 'model' | 'text';

interface SceneObjectSelectionState {
  selectedIds: Set<string>;
  /** Backward-compat: returns the single selected ID when exactly 1 is selected */
  selectedModelId: string | null;
  /** The primary (anchor) object for TransformControls — non-null even during multi-select */
  primarySelectedId: string | null;
  selectedObjectType: SelectedObjectType | null;
  selectModel: (id: string) => void;
  selectText: (id: string) => void;
  toggleModel: (id: string) => void;
  toggleText: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelectedModel: () => void;
}

function deriveCompat(ids: Set<string>, type: SelectedObjectType | null, primaryId?: string | null) {
  const resolvedPrimary = primaryId && ids.has(primaryId)
    ? primaryId
    : ids.size > 0
      ? ids.values().next().value!
      : null;

  return {
    selectedIds: ids,
    selectedModelId: ids.size === 1 ? ids.values().next().value! : null,
    primarySelectedId: resolvedPrimary,
    selectedObjectType: ids.size > 0 ? type : null,
  };
}

export const useSceneObjectSelectionStore = create<SceneObjectSelectionState>()(
  (set) => ({
    selectedIds: new Set<string>(),
    selectedModelId: null,
    primarySelectedId: null,
    selectedObjectType: null,

    selectModel: (id) =>
      set(deriveCompat(new Set([id]), 'model', id)),

    selectText: (id) =>
      set(deriveCompat(new Set([id]), 'text', id)),

    toggleModel: (id) =>
      set((state) => {
        const next = new Set(state.selectedIds);
        const isAdding = !next.has(id);
        if (isAdding) {
          next.add(id);
        } else {
          next.delete(id);
        }
        const primary = isAdding
          ? id
          : state.primarySelectedId === id
            ? undefined
            : state.primarySelectedId;
        return deriveCompat(next, next.size > 0 ? 'model' : null, primary);
      }),

    toggleText: (id) =>
      set((state) => {
        const next = new Set(state.selectedIds);
        const isAdding = !next.has(id);
        if (isAdding) {
          next.add(id);
        } else {
          next.delete(id);
        }
        const primary = isAdding
          ? id
          : state.primarySelectedId === id
            ? undefined
            : state.primarySelectedId;
        return deriveCompat(next, next.size > 0 ? 'text' : null, primary);
      }),

    selectAll: (ids) =>
      set(deriveCompat(new Set(ids), ids.length > 0 ? 'model' : null, ids[0])),

    clearSelectedModel: () =>
      set(deriveCompat(new Set(), null, null)),
  }),
);
