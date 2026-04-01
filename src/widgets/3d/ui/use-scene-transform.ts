import { useCallback, useEffect, useRef, useState } from 'react';
import { Object3D } from 'three';
import type { TransformControls as TransformControlsImpl } from 'three-stdlib';
import { numRound, radToDeg } from '@/entities/3d';
import type { SceneTransformField } from '@/features/3d';
import type { Vector3Tuple } from '@/shared/types/math';

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

function getObjectTransformVectors(
  object: Object3D,
): Record<SceneTransformField, Vector3Tuple> {
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

interface UseSceneTransformParams {
  selectedModelId: string | null;
  sceneModels: { id: string }[] | undefined;
  sceneTexts?: { id: string }[] | undefined;
  modelObjectRegistryRef: React.RefObject<Map<string, Object3D>>;
  onTransformVectorChange: (
    field: SceneTransformField,
    value: Vector3Tuple,
  ) => void;
  onTransformInteractionStart?: () => void;
  onTransformInteractionEnd?: () => void;
}

export function useSceneTransform({
  selectedModelId,
  sceneModels,
  sceneTexts,
  modelObjectRegistryRef,
  onTransformVectorChange,
  onTransformInteractionStart,
  onTransformInteractionEnd,
}: UseSceneTransformParams) {
  const orbitControlsRef = useRef<import('three-stdlib').OrbitControls | null>(
    null,
  );
  const transformControlsRef = useRef<TransformControlsImpl | null>(null);
  const [selectedObject, setSelectedObject] = useState<Object3D | null>(null);
  const [isTransformDragging, setIsTransformDragging] = useState(false);

  const syncSelectedObjectTransform = useCallback(() => {
    if (!selectedObject || !selectedModelId) {
      return;
    }

    const nextTransform = getObjectTransformVectors(selectedObject);
    onTransformVectorChange('position', nextTransform.position);
    onTransformVectorChange('rotation', nextTransform.rotation);
    onTransformVectorChange('scale', nextTransform.scale);
  }, [onTransformVectorChange, selectedModelId, selectedObject]);

  const handleTransformMouseDown = useCallback(() => {
    setIsTransformDragging(true);
    onTransformInteractionStart?.();
  }, [onTransformInteractionStart]);

  const handleTransformMouseUp = useCallback(() => {
    syncSelectedObjectTransform();
    setIsTransformDragging(false);
    onTransformInteractionEnd?.();
  }, [onTransformInteractionEnd, syncSelectedObjectTransform]);

  useEffect(() => {
    if (!orbitControlsRef.current) {
      return;
    }

    orbitControlsRef.current.enabled = !isTransformDragging;
  }, [isTransformDragging]);

  useEffect(() => {
    if (!selectedModelId) {
      setSelectedObject(null);
      setIsTransformDragging(false);
      return;
    }

    const isSelectedModelPresent =
      (sceneModels?.some((model) => model.id === selectedModelId) ?? false) ||
      (sceneTexts?.some((t) => t.id === selectedModelId) ?? false);

    if (!isSelectedModelPresent) {
      setSelectedObject(null);
      setIsTransformDragging(false);
      modelObjectRegistryRef.current.delete(selectedModelId);
      return;
    }

    const nextSelectedObject =
      modelObjectRegistryRef.current.get(selectedModelId) ?? null;

    if (nextSelectedObject) {
      setSelectedObject(nextSelectedObject);
    }
  }, [sceneModels, selectedModelId, modelObjectRegistryRef]);

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

  const transformTarget = selectedObject?.parent ? selectedObject : null;

  useEffect(() => {
    const controls = transformControlsRef.current;

    if (!controls || transformTarget) {
      return;
    }

    controls.detach();
  }, [transformTarget]);

  return {
    orbitControlsRef,
    transformControlsRef,
    selectedObject,
    setSelectedObject,
    isTransformDragging,
    setIsTransformDragging,
    transformTarget,
    syncSelectedObjectTransform,
    handleTransformMouseDown,
    handleTransformMouseUp,
  };
}
