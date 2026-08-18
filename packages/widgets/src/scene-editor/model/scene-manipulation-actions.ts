import {
  createSceneModel,
  createSceneText,
  type SavedSceneInfo,
  type SceneMapCatalogItem,
  type SceneModelCatalogItem,
} from '@crane/domain/3d';
import { createId } from '@crane/core/lib/create-id';
import type { MutableRefObject, SetStateAction } from 'react';

interface UpdateSceneOptions {
  recordHistory?: boolean;
}

interface SceneManipulationDeps {
  updateScene: (
    updater: SetStateAction<SavedSceneInfo | null>,
    options?: UpdateSceneOptions,
  ) => void;
  commitHistoryFrom: (base: SavedSceneInfo | null) => void;
  selectModel: (id: string) => void;
  selectText: (id: string) => void;
  selectMap: (id: string) => void;
  clearSelectedModel: () => void;
  selectedIds: Set<string>;
  sceneInfoRef: MutableRefObject<SavedSceneInfo | null>;
  selectAll: (ids: string[]) => void;
  transformHistoryBaseRef: MutableRefObject<SavedSceneInfo | null>;
}

export function createSceneManipulationActions({
  updateScene,
  commitHistoryFrom,
  selectModel,
  selectText,
  selectMap,
  clearSelectedModel,
  selectedIds,
  sceneInfoRef,
  selectAll,
  transformHistoryBaseRef,
}: SceneManipulationDeps) {
  const addModel = (
    catalogItem: SceneModelCatalogItem,
    position: [number, number, number],
  ) => {
    const nextModel = createSceneModel({
      catalogItem,
      position,
    });

    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        models: [...prev.models, nextModel],
      };
    });

    selectModel(nextModel.id);
  };

  const addText = (position: [number, number, number]) => {
    const nextText = createSceneText({ position });

    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        texts: [...(prev.texts ?? []), nextText],
      };
    });

    selectText(nextText.id);
  };

  const deletePlacedText = (id: string) => {
    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      // 잠긴 텍스트는 삭제 불가 — 계층 목록은 잠긴 행의 삭제 버튼을 숨기지만,
      // updater 안에서 한 번 더 막아야 다른 호출 경로가 생겨도 안전하다.
      if ((prev.texts ?? []).some((t) => t.id === id && t.locked)) {
        return prev;
      }

      return {
        ...prev,
        texts: (prev.texts ?? []).filter((t) => t.id !== id),
      };
    });

    if (selectedIds.has(id)) {
      clearSelectedModel();
    }
  };

  /**
   * 지도 선택 — 배경(setEnvironmentId)과 같은 클릭 단일 선택.
   * null이면 지도를 제거한다.
   *
   * 현재 지도가 잠겨 있으면 아무것도 하지 않는다 — 잠금은 선택·변형·삭제를
   * 모두 막는 규칙이고, 교체는 삭제를 포함한다. UI(PaletteMapSection)도
   * 잠금 상태에서 타일을 비활성화하지만, 여기서 한 번 더 막아야 다른
   * 경로가 생겨도 규칙이 깨지지 않는다.
   *
   * 새로 고른 지도는 잠기지 않은 상태로 시작한다 — 배치(이동/회전)를 먼저
   * 하고, 계층 목록의 자물쇠로 잠근다.
   */
  const setSceneMap = (catalogItem: SceneMapCatalogItem | null) => {
    const currentMap = (sceneInfoRef.current?.maps ?? [])[0] ?? null;
    if (currentMap && currentMap.locked !== false) {
      return;
    }
    if (!catalogItem && !currentMap) {
      return;
    }
    if (catalogItem && currentMap?.path === catalogItem.path) {
      return;
    }

    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        maps: catalogItem
          ? [{ id: createId(), path: catalogItem.path, locked: false }]
          : [],
      };
    });

    if (currentMap && selectedIds.has(currentMap.id)) {
      clearSelectedModel();
    }
  };

  const selectPlacedModel = (id: string) => {
    selectModel(id);
  };

  const selectPlacedMap = (id: string) => {
    selectMap(id);
  };

  /**
   * 배경 파노라마 선택. null이면 "배경 없음"을 명시적으로 저장한다 —
   * undefined로 지우면 region 기본 배경이 되살아나 사용자가 끌 수 없다.
   */
  const setEnvironmentId = (environmentId: string | null) => {
    updateScene((prev) => {
      if (!prev) return prev;
      if (prev.environmentId === environmentId) return prev;
      return { ...prev, environmentId };
    });
  };

  const selectPlacedText = (id: string) => {
    selectText(id);
  };

  const deletePlacedModel = (id: string) => {
    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      // 잠긴 모델은 삭제 불가 — 계층 목록은 잠긴 행의 삭제 버튼을 숨기지만,
      // updater 안에서 한 번 더 막아야 다른 호출 경로가 생겨도 안전하다.
      if (prev.models.some((model) => model.id === id && model.locked)) {
        return prev;
      }

      return {
        ...prev,
        models: prev.models.filter((model) => model.id !== id),
      };
    });

    if (selectedIds.has(id)) {
      clearSelectedModel();
    }
  };

  const startTransformInteraction = () => {
    transformHistoryBaseRef.current = sceneInfoRef.current;
  };

  const endTransformInteraction = () => {
    commitHistoryFrom(transformHistoryBaseRef.current);
    transformHistoryBaseRef.current = null;
  };

  const duplicateSelectedObject = () => {
    if (selectedIds.size === 0) return;

    const scene = sceneInfoRef.current;
    if (!scene) return;

    const newModelDuplicates: typeof scene.models = [];
    const newTextDuplicates: NonNullable<typeof scene.texts> = [];
    const newIds: string[] = [];

    for (const id of selectedIds) {
      const modelSource = scene.models.find((m) => m.id === id);
      if (modelSource) {
        const newId = createId();
        newIds.push(newId);
        newModelDuplicates.push({
          ...modelSource,
          id: newId,
          // 잠긴 모델은 선택 자체가 안 되니 여기 올 수 없지만, 복제본이
          // 잠김을 물려받는 일은 어떤 경로로도 없어야 한다.
          locked: undefined,
          position: [
            modelSource.position[0] + 2,
            modelSource.position[1],
            modelSource.position[2],
          ] as [number, number, number],
        });
        continue;
      }

      const textSource = (scene.texts ?? []).find((t) => t.id === id);
      if (textSource) {
        const newId = createId();
        newIds.push(newId);
        newTextDuplicates.push({
          ...textSource,
          id: newId,
          // 모델 복제와 같은 규칙 — 복제본이 잠김을 물려받지 않는다.
          locked: undefined,
          position: [
            textSource.position[0] + 2,
            textSource.position[1],
            textSource.position[2],
          ] as [number, number, number],
        });
      }
    }

    if (newModelDuplicates.length === 0 && newTextDuplicates.length === 0)
      return;

    updateScene((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        models: [...prev.models, ...newModelDuplicates],
        texts: [...(prev.texts ?? []), ...newTextDuplicates],
      };
    });

    selectAll(newIds);
  };

  return {
    addModel,
    addText,
    setSceneMap,
    selectPlacedMap,
    setEnvironmentId,
    selectPlacedModel,
    selectPlacedText,
    deletePlacedModel,
    deletePlacedText,
    startTransformInteraction,
    endTransformInteraction,
    duplicateSelectedObject,
  };
}
