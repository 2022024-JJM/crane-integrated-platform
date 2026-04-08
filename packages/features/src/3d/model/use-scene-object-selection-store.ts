import { create } from 'zustand';

export type SelectedObjectType = 'model' | 'text' | 'mesh' | 'sensor';

interface SceneObjectSelectionState {
  selectedIds: Set<string>;
  /** Backward-compat: returns the single selected ID when exactly 1 is selected */
  selectedModelId: string | null;
  /** The primary (anchor) object for TransformControls — non-null even during multi-select */
  primarySelectedId: string | null;
  selectedObjectType: SelectedObjectType | null;
  selectModel: (id: string) => void;
  selectText: (id: string) => void;
  selectMesh: (meshId: string) => void;
  selectSensor: (id: string) => void;
  toggleModel: (id: string) => void;
  toggleText: (id: string) => void;
  toggleMesh: (meshId: string) => void;
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

    selectMesh: (meshId) =>
      set(deriveCompat(new Set([meshId]), 'mesh', meshId)),

    selectSensor: (id) =>
      set(deriveCompat(new Set([id]), 'sensor', id)),

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

    toggleMesh: (meshId) =>
      set((state) => {
        const next = new Set(state.selectedIds);
        const isAdding = !next.has(meshId);
        if (isAdding) {
          next.add(meshId);
        } else {
          next.delete(meshId);
        }
        const primary = isAdding
          ? meshId
          : state.primarySelectedId === meshId
            ? undefined
            : state.primarySelectedId;
        return deriveCompat(next, next.size > 0 ? 'mesh' : null, primary);
      }),

    selectAll: (ids) =>
      set(deriveCompat(new Set(ids), ids.length > 0 ? 'model' : null, ids[0])),

    clearSelectedModel: () =>
      set(deriveCompat(new Set(), null, null)),
  }),
);

/**
 * 특정 객체가 현재 선택되었는지 boolean으로만 구독한다.
 *
 * 모델 N개를 렌더링하는 캔버스에서 부모가 `selectedIds: Set<string>` 자체를
 * 구독하면, 어떤 객체 하나만 선택해도 Set 참조가 바뀌어 N개의 자식이 모두
 * 리렌더된다. 각 모델 컴포넌트가 이 hook으로 자신의 boolean만 구독하면
 * "이전 선택 + 새 선택" 두 컴포넌트만 리렌더된다.
 */
export function useIsObjectSelected(id: string): boolean {
  return useSceneObjectSelectionStore((state) => state.selectedIds.has(id));
}

/**
 * 다중 선택(2개 이상) 여부만 boolean으로 구독한다. 단일 선택 ↔ 다중 전환
 * 시점에만 리렌더가 발생한다.
 */
export function useIsMultiSelection(): boolean {
  return useSceneObjectSelectionStore((state) => state.selectedIds.size > 1);
}
