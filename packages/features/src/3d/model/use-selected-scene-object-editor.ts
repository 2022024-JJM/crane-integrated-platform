import {
  numRound,
  type SavedModelInfo,
  type SavedSceneInfo,
  type SavedTextInfo,
} from '@crane/domain/3d';
import { useEffect, useMemo, type SetStateAction } from 'react';
import type { Vector3Tuple } from '@crane/core/types/math';
import { clampToRange } from '@crane/core/lib/utils';
import { useSceneObjectSelectionStore } from './use-scene-object-selection-store';
import { AXIS_INDEX, type AxisKey, type SceneTransformField } from './types';

function updateVectorValue(tuple: Vector3Tuple, axis: AxisKey, value: number) {
  const nextTuple = [...tuple] as Vector3Tuple;
  nextTuple[AXIS_INDEX[axis]] = value;
  return nextTuple;
}

function roundVectorValue(tuple: Vector3Tuple): Vector3Tuple {
  return tuple.map((value) => numRound(value)) as Vector3Tuple;
}

function clampOpacity(value: number) {
  return numRound(clampToRange(value, 0.1, 1));
}

interface UseSelectedSceneObjectEditorParams {
  sceneInfo: SavedSceneInfo | null;
  updateSceneInfo: (
    updater: SetStateAction<SavedSceneInfo | null>,
    options?: {
      recordHistory?: boolean;
    },
  ) => void;
}

interface UseSelectedSceneObjectEditorResult {
  selectedModel: SavedModelInfo | null;
  selectedText: SavedTextInfo | null;
  updateSelectedName: (name: string) => void;
  updateSelectedOpacity: (value: number) => void;
  updateSelectedTransform: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  updateSelectedTransformVector: (
    field: SceneTransformField,
    value: Vector3Tuple,
    options?: {
      recordHistory?: boolean;
    },
  ) => void;
  updateSelectedTextContent: (content: string) => void;
  updateSelectedTextColor: (color: string) => void;
  updateSelectedTextTransform: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  updateSelectedTextTransformVector: (
    field: SceneTransformField,
    value: Vector3Tuple,
    options?: {
      recordHistory?: boolean;
    },
  ) => void;
  updateMultiObjectPositions: (
    updates: Array<{ id: string; position: Vector3Tuple }>,
    options?: { recordHistory?: boolean },
  ) => void;
  removeSelectedModel: () => void;
}

export function useSelectedSceneObjectEditor({
  sceneInfo,
  updateSceneInfo,
}: UseSelectedSceneObjectEditorParams): UseSelectedSceneObjectEditorResult {
  const selectedModelId = useSceneObjectSelectionStore(
    (state) => state.selectedModelId,
  );
  const selectedObjectType = useSceneObjectSelectionStore(
    (state) => state.selectedObjectType,
  );
  const selectedIds = useSceneObjectSelectionStore(
    (state) => state.selectedIds,
  );
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );

  useEffect(() => {
    if (!sceneInfo || !selectedModelId) {
      return;
    }

    if (selectedObjectType === 'text') {
      const exists = (sceneInfo.texts ?? []).some(
        (t) => t.id === selectedModelId,
      );
      if (!exists) {
        clearSelectedModel();
      }
      return;
    }

    const isSelectedModelExists = sceneInfo.models.some(
      (model) => model.id === selectedModelId,
    );

    if (!isSelectedModelExists) {
      clearSelectedModel();
    }
  }, [clearSelectedModel, sceneInfo, selectedModelId, selectedObjectType]);

  const selectedModel = useMemo(
    () =>
      selectedObjectType === 'model'
        ? (sceneInfo?.models.find((model) => model.id === selectedModelId) ??
          null)
        : null,
    [sceneInfo?.models, selectedModelId, selectedObjectType],
  );

  const selectedText = useMemo(
    () =>
      selectedObjectType === 'text'
        ? ((sceneInfo?.texts ?? []).find((t) => t.id === selectedModelId) ??
          null)
        : null,
    [sceneInfo?.texts, selectedModelId, selectedObjectType],
  );

  const updateSelectedName = (name: string) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return {
        ...prev,
        models: prev.models.map((model) => {
          if (model.id !== selectedModelId) {
            return model;
          }

          return {
            ...model,
            equipName: name,
          };
        }),
      };
    });
  };

  const updateSelectedOpacity = (value: number) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return {
        ...prev,
        models: prev.models.map((model) => {
          if (model.id !== selectedModelId) {
            return model;
          }

          return {
            ...model,
            opacity: clampOpacity(value),
          };
        }),
      };
    });
  };

  const updateSelectedTransform = (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return {
        ...prev,
        models: prev.models.map((model) => {
          if (model.id !== selectedModelId) {
            return model;
          }

          return {
            ...model,
            [field]: updateVectorValue(model[field], axis, numRound(value)),
          };
        }),
      };
    });
  };

  const updateSelectedTransformVector = (
    field: SceneTransformField,
    value: Vector3Tuple,
    options?: {
      recordHistory?: boolean;
    },
  ) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return {
        ...prev,
        models: prev.models.map((model) => {
          if (model.id !== selectedModelId) {
            return model;
          }

          return {
            ...model,
            [field]: roundVectorValue(value),
          };
        }),
      };
    }, options);
  };

  const updateSelectedTextContent = (content: string) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return {
        ...prev,
        texts: (prev.texts ?? []).map((t) =>
          t.id === selectedModelId ? { ...t, content } : t,
        ),
      };
    });
  };

  const updateSelectedTextColor = (color: string) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return {
        ...prev,
        texts: (prev.texts ?? []).map((t) =>
          t.id === selectedModelId ? { ...t, color } : t,
        ),
      };
    });
  };

  const updateSelectedTextTransform = (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return {
        ...prev,
        texts: (prev.texts ?? []).map((t) => {
          if (t.id !== selectedModelId) {
            return t;
          }

          return {
            ...t,
            [field]: updateVectorValue(t[field], axis, numRound(value)),
          };
        }),
      };
    });
  };

  const updateSelectedTextTransformVector = (
    field: SceneTransformField,
    value: Vector3Tuple,
    options?: {
      recordHistory?: boolean;
    },
  ) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return {
        ...prev,
        texts: (prev.texts ?? []).map((t) => {
          if (t.id !== selectedModelId) {
            return t;
          }

          return {
            ...t,
            [field]: roundVectorValue(value),
          };
        }),
      };
    }, options);
  };

  const updateMultiObjectPositions = (
    updates: Array<{ id: string; position: Vector3Tuple }>,
    options?: { recordHistory?: boolean },
  ) => {
    if (updates.length === 0) return;

    const updateMap = new Map(updates.map((u) => [u.id, u.position]));

    updateSceneInfo((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        models: prev.models.map((model) => {
          const pos = updateMap.get(model.id);
          if (!pos) return model;
          return { ...model, position: roundVectorValue(pos) };
        }),
        texts: (prev.texts ?? []).map((t) => {
          const pos = updateMap.get(t.id);
          if (!pos) return t;
          return { ...t, position: roundVectorValue(pos) };
        }),
      };
    }, options);
  };

  const removeSelectedModel = () => {
    if (selectedIds.size === 0) {
      return;
    }

    updateSceneInfo((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        models: prev.models.filter((model) => !selectedIds.has(model.id)),
        texts: (prev.texts ?? []).filter((t) => !selectedIds.has(t.id)),
      };
    });

    clearSelectedModel();
  };

  return {
    selectedModel,
    selectedText,
    updateSelectedName,
    updateSelectedOpacity,
    updateSelectedTransform,
    updateSelectedTransformVector,
    updateSelectedTextContent,
    updateSelectedTextColor,
    updateSelectedTextTransform,
    updateSelectedTextTransformVector,
    updateMultiObjectPositions,
    removeSelectedModel,
  };
}
