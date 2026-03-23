import { numRound, radToDeg, type SavedSceneInfo } from '@/entities/3d';
import { useSceneObjectSelectionStore } from '@/features/3d';
import { useEffect, useMemo, useState } from 'react';
import type { Vector3Tuple } from '@/shared/types/math';
import { SceneObjectInspector, SceneObjectsEditCanvas } from '@/widgets/3d';

const SCENE_FILE_URL = '/scenes/1dock.json';
const AXIS_INDEX = {
  x: 0,
  y: 1,
  z: 2,
} as const;

function updateVectorValue(
  tuple: Vector3Tuple,
  axis: keyof typeof AXIS_INDEX,
  value: number,
) {
  const nextTuple = [...tuple] as Vector3Tuple;
  nextTuple[AXIS_INDEX[axis]] = value;
  return nextTuple;
}

export function SceneObjectsEditPage() {
  const [sceneInfo, setSceneInfo] = useState<SavedSceneInfo | null>(null);
  const selectedModelId = useSceneObjectSelectionStore(
    (state) => state.selectedModelId,
  );
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );

  useEffect(() => {
    let isMounted = true;

    const loadScene = async () => {
      try {
        const res = await fetch(SCENE_FILE_URL);
        const data: SavedSceneInfo = await res.json();

        if (!isMounted) {
          return;
        }

        setSceneInfo(data);
      } catch (error) {
        console.error('Failed to load scene editor data.', error);
      }
    };

    void loadScene();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      clearSelectedModel();
    };
  }, [clearSelectedModel]);

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

  const updateSelectedModel = (
    key: 'position' | 'rotation' | 'scale',
    axis: keyof typeof AXIS_INDEX,
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
            [key]: updateVectorValue(model[key], axis, value),
          };
        }),
      };
    });
  };

  return (
    <div className="bg-muted/20 flex h-full min-h-0 w-full overflow-hidden">
      <div className="min-w-0 flex-1">
        <SceneObjectsEditCanvas sceneInfo={sceneInfo} />
      </div>
      <aside className="absolute top-2 right-2 w-60 shrink-0">
        <SceneObjectInspector
          selectedModel={selectedModel}
          onPositionChange={(axis, value) => {
            updateSelectedModel('position', axis, numRound(value));
          }}
          onRotationChange={(axis, value) => {
            updateSelectedModel('rotation', axis, numRound(radToDeg(value)));
          }}
          onScaleChange={(axis, value) => {
            updateSelectedModel('scale', axis, numRound(value));
          }}
        />
      </aside>
    </div>
  );
}
