import {
  createSceneModel,
  createSceneText,
  type SavedSceneInfo,
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

      return {
        ...prev,
        texts: (prev.texts ?? []).filter((t) => t.id !== id),
      };
    });

    if (selectedIds.has(id)) {
      clearSelectedModel();
    }
  };

  const deleteMap = () => {
    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        map: null,
      };
    });
  };

  const selectPlacedModel = (id: string) => {
    selectModel(id);
  };

  const selectPlacedText = (id: string) => {
    selectText(id);
  };

  const deletePlacedModel = (id: string) => {
    updateScene((prev) => {
      if (!prev) {
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
          position: [
            textSource.position[0] + 2,
            textSource.position[1],
            textSource.position[2],
          ] as [number, number, number],
        });
      }
    }

    if (newModelDuplicates.length === 0 && newTextDuplicates.length === 0) return;

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
    deleteMap,
    selectPlacedModel,
    selectPlacedText,
    deletePlacedModel,
    deletePlacedText,
    startTransformInteraction,
    endTransformInteraction,
    duplicateSelectedObject,
  };
}
