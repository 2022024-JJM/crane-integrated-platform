import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  Camera,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { numRound, type SceneModelCatalogItem } from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';

const SCENE_MODEL_DRAG_TYPE = 'application/x-scene-model-id';
const SCENE_TEXT_DRAG_TYPE = 'application/x-scene-text';

function getDraggedCatalogItemId(event: DragEvent<HTMLDivElement>) {
  return (
    event.dataTransfer.getData(SCENE_MODEL_DRAG_TYPE) ||
    event.dataTransfer.getData('text/plain')
  );
}

function hasSceneDragData(event: DragEvent<HTMLDivElement>) {
  return Array.from(event.dataTransfer.types).some(
    (type) =>
      type === SCENE_MODEL_DRAG_TYPE ||
      type === SCENE_TEXT_DRAG_TYPE ||
      type === 'text/plain',
  );
}

function isTextDrag(event: DragEvent<HTMLDivElement>) {
  return event.dataTransfer.getData(SCENE_TEXT_DRAG_TYPE) === 'text';
}

interface UseSceneDropParams {
  catalogItems: SceneModelCatalogItem[];
  draggingModelCatalogItem: SceneModelCatalogItem | null;
  isDraggingText?: boolean;
  onAddModel: (
    catalogItem: SceneModelCatalogItem,
    position: Vector3Tuple,
  ) => void;
  onAddText?: (position: Vector3Tuple) => void;
}

export function useSceneDrop({
  catalogItems,
  draggingModelCatalogItem,
  isDraggingText = false,
  onAddModel,
  onAddText,
}: UseSceneDropParams) {
  const cameraRef = useRef<Camera | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const groundPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  const [pendingDropPosition, setPendingDropPosition] =
    useState<Vector3Tuple | null>(null);

  const resolveDropPosition = useCallback(
    (clientX: number, clientY: number): Vector3Tuple | null => {
      const camera = cameraRef.current;
      const renderer = rendererRef.current;

      if (!camera || !renderer) {
        return null;
      }

      const rect = renderer.domElement.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        return null;
      }

      const pointer = new Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const hitPoint = new Vector3();

      raycasterRef.current.setFromCamera(pointer, camera);

      if (!raycasterRef.current.ray.intersectPlane(groundPlane, hitPoint)) {
        return null;
      }

      return [
        numRound(hitPoint.x),
        numRound(hitPoint.y),
        numRound(hitPoint.z),
      ];
    },
    [groundPlane],
  );

  const handleSceneDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (
        !draggingModelCatalogItem &&
        !isDraggingText &&
        !hasSceneDragData(event)
      ) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setPendingDropPosition(resolveDropPosition(event.clientX, event.clientY));
    },
    [draggingModelCatalogItem, isDraggingText, resolveDropPosition],
  );

  const handleSceneDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const nextPosition = resolveDropPosition(event.clientX, event.clientY);

      if (isTextDrag(event) || isDraggingText) {
        if (nextPosition) {
          onAddText?.(nextPosition);
        }
        event.currentTarget.focus();
        setPendingDropPosition(null);
        return;
      }

      const draggedItemId = getDraggedCatalogItemId(event);
      const droppedCatalogItem =
        catalogItems.find((item) => item.id === draggedItemId) ??
        draggingModelCatalogItem;

      if (!droppedCatalogItem) {
        setPendingDropPosition(null);
        return;
      }

      if (nextPosition) {
        onAddModel(droppedCatalogItem, nextPosition);
      }

      event.currentTarget.focus();
      setPendingDropPosition(null);
    },
    [
      catalogItems,
      draggingModelCatalogItem,
      isDraggingText,
      onAddModel,
      onAddText,
      resolveDropPosition,
    ],
  );

  const handleDragLeave = useCallback(() => {
    setPendingDropPosition(null);
  }, []);

  return {
    cameraRef,
    rendererRef,
    pendingDropPosition,
    setPendingDropPosition,
    handleSceneDragOver,
    handleSceneDrop,
    handleDragLeave,
  };
}

export { SCENE_MODEL_DRAG_TYPE, SCENE_TEXT_DRAG_TYPE };
