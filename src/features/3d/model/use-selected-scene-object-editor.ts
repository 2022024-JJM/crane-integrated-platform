import {
  numRound,
  type SavedModelInfo,
  type SavedSceneInfo,
} from '@/entities/3d';
import { useEffect, useMemo, type SetStateAction } from 'react';
import type { Vector3Tuple } from '@/shared/types/math';
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
  return numRound(Math.min(1, Math.max(0.1, value)));
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
  removeSelectedModel: () => void;
}

export function useSelectedSceneObjectEditor({
  sceneInfo,
  updateSceneInfo,
}: UseSelectedSceneObjectEditorParams): UseSelectedSceneObjectEditorResult {
  const selectedModelId = useSceneObjectSelectionStore(
    (state) => state.selectedModelId,
  );
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );

  useEffect(() => {
    if (!sceneInfo || !selectedModelId) {
      return;
    }

    const isSelectedModelExists = sceneInfo.models.some(
      (model) => model.id === selectedModelId,
    );

    if (!isSelectedModelExists) {
      clearSelectedModel();
    }
  }, [clearSelectedModel, sceneInfo, selectedModelId]);

  const selectedModel = useMemo(
    () =>
      sceneInfo?.models.find((model) => model.id === selectedModelId) ?? null,
    [sceneInfo?.models, selectedModelId],
  );

  const updateSelectedName = (name: string) => {
    const nextName = name.trim();

    if (!nextName) {
      return;
    }

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
            equipName: nextName,
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
    updateSceneInfo(
      (prev) => {
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
      },
      options,
    );
  };

  const removeSelectedModel = () => {
    if (!selectedModelId) {
      return;
    }

    updateSceneInfo((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        models: prev.models.filter((model) => model.id !== selectedModelId),
      };
    });

    clearSelectedModel();
  };

  return {
    selectedModel,
    updateSelectedName,
    updateSelectedOpacity,
    updateSelectedTransform,
    updateSelectedTransformVector,
    removeSelectedModel,
  };
}
