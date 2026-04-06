import {
  createSceneModel,
  createSceneText,
  type SavedSceneInfo,
  type SceneModelCatalogItem,
} from '@crane/domain/3d';
import { createId } from '@crane/core/lib/create-id';
import type { MutableRefObject, SetStateAction } from 'react';
import type { SelectedObjectType } from '@crane/features/3d';

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
  selectedModelId: string | null;
  selectedObjectType: SelectedObjectType | null;
  sceneInfoRef: MutableRefObject<SavedSceneInfo | null>;
  transformHistoryBaseRef: MutableRefObject<SavedSceneInfo | null>;
}

export function createSceneManipulationActions({
  updateScene,
  commitHistoryFrom,
  selectModel,
  selectText,
  clearSelectedModel,
  selectedModelId,
  selectedObjectType,
  sceneInfoRef,
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

    if (selectedModelId === id) {
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

    if (selectedModelId === id) {
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
    if (!selectedModelId) return;

    const scene = sceneInfoRef.current;
    if (!scene) return;

    if (selectedObjectType === 'text') {
      const source = (scene.texts ?? []).find((t) => t.id === selectedModelId);
      if (!source) return;

      const newId = createId();
      const duplicate = {
        ...source,
        id: newId,
        position: [
          source.position[0] + 2,
          source.position[1],
          source.position[2],
        ] as [number, number, number],
      };

      updateScene((prev) => {
        if (!prev) return prev;
        return { ...prev, texts: [...(prev.texts ?? []), duplicate] };
      });

      selectText(newId);
    } else {
      const source = scene.models.find((m) => m.id === selectedModelId);
      if (!source) return;

      const newId = createId();
      const duplicate = {
        ...source,
        id: newId,
        position: [
          source.position[0] + 2,
          source.position[1],
          source.position[2],
        ] as [number, number, number],
      };

      updateScene((prev) => {
        if (!prev) return prev;
        return { ...prev, models: [...prev.models, duplicate] };
      });

      selectModel(newId);
    }
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
