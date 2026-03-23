import {
  numRound,
  type SavedModelInfo,
  type SavedSceneInfo,
} from '@/entities/3d';
import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
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

interface UseSelectedSceneObjectEditorParams {
  sceneInfo: SavedSceneInfo | null;
  setSceneInfo: Dispatch<SetStateAction<SavedSceneInfo | null>>;
}

interface UseSelectedSceneObjectEditorResult {
  selectedModel: SavedModelInfo | null;
  updateSelectedTransform: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  updateSelectedTransformVector: (
    field: SceneTransformField,
    value: Vector3Tuple,
  ) => void;
}

export function useSelectedSceneObjectEditor({
  sceneInfo,
  setSceneInfo,
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

  const updateSelectedTransform = (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => {
    setSceneInfo((prev) => {
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
  ) => {
    setSceneInfo((prev) => {
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
    });
  };

  return {
    selectedModel,
    updateSelectedTransform,
    updateSelectedTransformVector,
  };
}
