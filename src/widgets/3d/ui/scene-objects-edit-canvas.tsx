import { OrbitControls, TransformControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Object3D } from 'three';
import type {
  OrbitControls as OrbitControlsImpl,
  TransformControls as TransformControlsImpl,
} from 'three-stdlib';
import {
  GltfModel,
  numRound,
  radToDeg,
  type SavedSceneInfo,
} from '@/entities/3d';
import {
  type SceneTransformField,
  type SceneTransformMode,
  useSceneObjectSelectionStore,
} from '@/features/3d';
import type { Vector3Tuple } from '@/shared/types/math';

interface SceneObjectsEditCanvasProps {
  sceneInfo: SavedSceneInfo | null;
  transformMode: SceneTransformMode;
  onTransformVectorChange: (
    field: SceneTransformField,
    value: Vector3Tuple,
  ) => void;
}

interface TransformChangeEvent extends Event {
  value?: boolean;
}

type TransformControlsWithDraggingEvent = TransformControlsImpl & {
  addEventListener: (
    type: 'dragging-changed',
    listener: (event: TransformChangeEvent) => void,
  ) => void;
  removeEventListener: (
    type: 'dragging-changed',
    listener: (event: TransformChangeEvent) => void,
  ) => void;
};

function toVector3Tuple(values: [number, number, number]): Vector3Tuple {
  return values.map((value) => numRound(value)) as Vector3Tuple;
}

function getObjectTransformVectors(object: Object3D): Record<
  SceneTransformField,
  Vector3Tuple
> {
  return {
    position: toVector3Tuple([
      object.position.x,
      object.position.y,
      object.position.z,
    ]),
    rotation: toVector3Tuple([
      radToDeg(object.rotation.x),
      radToDeg(object.rotation.y),
      radToDeg(object.rotation.z),
    ]),
    scale: toVector3Tuple([object.scale.x, object.scale.y, object.scale.z]),
  };
}

export function SceneObjectsEditCanvas({
  sceneInfo,
  transformMode,
  onTransformVectorChange,
}: SceneObjectsEditCanvasProps) {
  const selectedModelId = useSceneObjectSelectionStore(
    (state) => state.selectedModelId,
  );
  const selectModel = useSceneObjectSelectionStore((state) => state.selectModel);
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);
  const transformControlsRef = useRef<TransformControlsImpl | null>(null);
  const modelObjectRegistryRef = useRef<Map<string, Object3D>>(new Map());
  const [selectedObject, setSelectedObject] = useState<Object3D | null>(null);
  const [isTransformDragging, setIsTransformDragging] = useState(false);

  const handleModelObjectReady = useCallback(
    (id: string, object: Object3D | null) => {
      if (object) {
        modelObjectRegistryRef.current.set(id, object);
      } else {
        modelObjectRegistryRef.current.delete(id);
      }

      if (id === selectedModelId) {
        setSelectedObject(object);
      }

      if (id === selectedModelId && !object) {
        setIsTransformDragging(false);
      }
    },
    [selectedModelId],
  );

  const handleSelectModel = useCallback(
    (id: string) => {
      setSelectedObject(modelObjectRegistryRef.current.get(id) ?? null);
      selectModel(id);
    },
    [selectModel],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedObject(null);
    setIsTransformDragging(false);
    clearSelectedModel();
  }, [clearSelectedModel]);

  const syncSelectedObjectTransform = useCallback(() => {
    if (!selectedObject || !selectedModelId) {
      return;
    }

    const nextTransform = getObjectTransformVectors(selectedObject);
    onTransformVectorChange('position', nextTransform.position);
    onTransformVectorChange('rotation', nextTransform.rotation);
    onTransformVectorChange('scale', nextTransform.scale);
  }, [onTransformVectorChange, selectedModelId, selectedObject]);

  useEffect(() => {
    if (!orbitControlsRef.current) {
      return;
    }

    orbitControlsRef.current.enabled = !isTransformDragging;
  }, [isTransformDragging]);

  useEffect(() => {
    const controls = transformControlsRef.current as
      | TransformControlsWithDraggingEvent
      | null;
    if (!controls) {
      return;
    }

    const handleDraggingChanged = (event: TransformChangeEvent) => {
      setIsTransformDragging(Boolean(event.value));
    };

    controls.addEventListener('dragging-changed', handleDraggingChanged);
    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChanged);
    };
  }, [selectedObject]);

  return (
    <Canvas
      camera={{ position: [0, 50, 50] }}
      onPointerMissed={handleClearSelection}
    >
      <ambientLight intensity={2} />
      <directionalLight position={[0, 50, 10]} color="white" intensity={5} />
      <OrbitControls ref={orbitControlsRef} enableDamping={false} />
      {selectedObject ? (
        <TransformControls
          ref={transformControlsRef}
          object={selectedObject}
          mode={transformMode}
          space="local"
          onMouseDown={() => {
            setIsTransformDragging(true);
          }}
          onMouseUp={() => {
            setIsTransformDragging(false);
          }}
          onObjectChange={syncSelectedObjectTransform}
        />
      ) : null}
      {sceneInfo?.map ? (
        <GltfModel
          id={sceneInfo.map.id}
          onSelect={handleClearSelection}
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
          onSelect={handleSelectModel}
          isSelected={model.id === selectedModelId}
          onObjectReady={handleModelObjectReady}
        />
      ))}
    </Canvas>
  );
}
