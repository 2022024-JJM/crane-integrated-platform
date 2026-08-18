import { create } from 'zustand';

export type SelectedObjectType = 'model' | 'text' | 'mesh' | 'map';

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
  /**
   * 지도 선택. 지도는 다중 선택에 참여하지 않는다 — 화면 전체를 덮는
   * 지형이라 마퀴나 Ctrl+클릭으로 다른 객체와 함께 잡히면 그룹 드래그가
   * 지형까지 통째로 옮겨 버린다. 항상 단독 선택이다.
   */
  selectMap: (id: string) => void;
  toggleModel: (id: string) => void;
  toggleText: (id: string) => void;
  toggleMesh: (meshId: string) => void;
  /**
   * 다중 선택 일괄 설정. 타입은 호출자가 안다 — 마퀴/Ctrl+A/복제 결과에
   * 텍스트가 섞일 수 있어 'model'로 하드코딩하면 단일 텍스트 선택이 존재
   * 검증(use-selected-scene-object-editor)에서 즉시 풀린다.
   */
  selectAll: (
    entries: Array<{ id: string; type: SelectedObjectType }>,
  ) => void;
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

    selectMap: (id) =>
      set(deriveCompat(new Set([id]), 'map', id)),

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

    // 태그는 primary(첫 항목)의 타입을 쓴다 — size 1에서 정확하면 충분하다.
    // size>1에서는 selectedModelId가 null이라 타입 태그를 읽는 소비자가
    // 사실상 없다(멀티 경로는 전부 id 기반).
    selectAll: (entries) =>
      set(
        deriveCompat(
          new Set(entries.map((e) => e.id)),
          entries[0]?.type ?? null,
          entries[0]?.id ?? null,
        ),
      ),

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
