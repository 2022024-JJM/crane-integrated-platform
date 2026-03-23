import { OrbitControls } from '@react-three/drei';
import {
  GltfModel,
  numRound,
  radToDeg,
  type SavedSceneInfo,
} from '@/entities/3d';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import type { Vector3Tuple } from '@/shared/types/math';
import { SceneObjectInspector } from '@/widgets/3d';

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
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

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
        <Canvas
          camera={{ position: [0, 50, 50] }}
          onPointerMissed={() => {
            setSelectedModelId(null);
          }}
        >
          <ambientLight intensity={2} />
          <directionalLight
            position={[0, 50, 10]}
            color={'white'}
            intensity={5}
          />
          <OrbitControls enableDamping={false} />
          {sceneInfo?.map ? (
            <GltfModel
              id={sceneInfo.map.id}
              onSelect={() => setSelectedModelId(null)}
              url={sceneInfo.map.path}
            />
          ) : null}
          {sceneInfo?.models.map((model) => (
            <GltfModel
              key={model.id}
              id={model.id}
              url={model.path}
              equipName={model.equipName}
              position={model.position}
              rotation={model.rotation}
              scale={model.scale}
              onSelect={setSelectedModelId}
              isSelected={model.id === selectedModelId}
            />
          ))}
        </Canvas>
      </div>
      <aside className="bg-background/95 w-[340px] shrink-0 border-l p-4 backdrop-blur-sm">
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
