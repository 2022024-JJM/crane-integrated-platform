import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  Camera,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  getModelBottomOffset,
  modelObjectRegistry,
  numRound,
  type SceneModelCatalogItem,
} from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';

const SCENE_MODEL_DRAG_TYPE = 'application/x-scene-model-id';
const SCENE_TEXT_DRAG_TYPE = 'application/x-scene-text';
const SCENE_SENSOR_DRAG_TYPE = 'application/x-scene-sensor';

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
      type === SCENE_SENSOR_DRAG_TYPE ||
      type === 'text/plain',
  );
}

function isTextDrag(event: DragEvent<HTMLDivElement>) {
  return event.dataTransfer.getData(SCENE_TEXT_DRAG_TYPE) === 'text';
}

/** 'lidar' | 'camera' | '' */
function getSensorDragType(event: DragEvent<HTMLDivElement>): '' | 'lidar' | 'camera' {
  const value = event.dataTransfer.getData(SCENE_SENSOR_DRAG_TYPE);
  if (value === 'lidar' || value === 'camera') return value;
  return '';
}

interface UseSceneDropParams {
  catalogItems: SceneModelCatalogItem[];
  draggingModelCatalogItem: SceneModelCatalogItem | null;
  isDraggingText?: boolean;
  /** lidar/camera 드래그 진행 중인지. 드래그 오버 미리보기 등에 사용. */
  draggingSensorType?: '' | 'lidar' | 'camera';
  /** 지도가 배치되어 있다면 그 id. 드롭 raycast가 ground plane이 아닌 지도
   *  표면을 대상으로 동작하도록 한다 (지도 표면 높이가 y!=0일 수 있음). */
  mapObjectId?: string | null;
  onAddModel: (
    catalogItem: SceneModelCatalogItem,
    position: Vector3Tuple,
  ) => void;
  onAddText?: (position: Vector3Tuple) => void;
  onAddLidarSensor?: (position: Vector3Tuple) => void;
  onAddCameraSensor?: (position: Vector3Tuple) => void;
}

export function useSceneDrop({
  catalogItems,
  draggingModelCatalogItem,
  isDraggingText = false,
  draggingSensorType = '',
  mapObjectId = null,
  onAddModel,
  onAddText,
  onAddLidarSensor,
  onAddCameraSensor,
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

      raycasterRef.current.setFromCamera(pointer, camera);

      // 1순위: 지도 mesh와 교차. 지도 표면 높이가 y!=0일 수 있어 ground plane
      // 으로 잡으면 모델이 항만 표면에서 떠 보이거나 박힌 채로 배치된다.
      const mapObject = mapObjectId ? modelObjectRegistry.get(mapObjectId) : null;
      if (mapObject) {
        const hits = raycasterRef.current.intersectObject(mapObject, true);
        if (hits.length > 0) {
          const point = hits[0].point;
          return [numRound(point.x), numRound(point.y), numRound(point.z)];
        }
      }

      // 2순위 fallback: y=0 ground plane
      const hitPoint = new Vector3();
      if (!raycasterRef.current.ray.intersectPlane(groundPlane, hitPoint)) {
        return null;
      }

      return [numRound(hitPoint.x), numRound(hitPoint.y), numRound(hitPoint.z)];
    },
    [groundPlane, mapObjectId],
  );

  const handleSceneDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (
        !draggingModelCatalogItem &&
        !isDraggingText &&
        !draggingSensorType &&
        !hasSceneDragData(event)
      ) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setPendingDropPosition(resolveDropPosition(event.clientX, event.clientY));
    },
    [
      draggingModelCatalogItem,
      isDraggingText,
      draggingSensorType,
      resolveDropPosition,
    ],
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

      const sensorKind = getSensorDragType(event) || draggingSensorType;
      if (sensorKind) {
        if (nextPosition) {
          if (sensorKind === 'lidar') {
            onAddLidarSensor?.(nextPosition);
          } else {
            onAddCameraSensor?.(nextPosition);
          }
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
        // 카탈로그 모델의 origin은 모델마다 다르다(중앙/바닥/상단). unscaled
        // bottomOffset에 사용자 scale.y를 곱해 world offset으로 만들고,
        // 드롭 위치 y에 더해 모델 바닥이 정확히 지면(y=0)에 닿도록 한다.
        // 캐시는 캔버스 mount 시 prefetchModelBottomOffset / 첫 mount 시
        // fillModelBottomOffsetFromClone으로 채워진다.
        const unscaledOffset =
          getModelBottomOffset(droppedCatalogItem.path) ?? 0;
        const scaledOffset = unscaledOffset * droppedCatalogItem.defaultScale[1];
        const adjustedPosition: Vector3Tuple = [
          nextPosition[0],
          numRound(nextPosition[1] + scaledOffset),
          nextPosition[2],
        ];
        onAddModel(droppedCatalogItem, adjustedPosition);
      }

      event.currentTarget.focus();
      setPendingDropPosition(null);
    },
    [
      catalogItems,
      draggingModelCatalogItem,
      draggingSensorType,
      isDraggingText,
      onAddModel,
      onAddText,
      onAddLidarSensor,
      onAddCameraSensor,
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

export {
  SCENE_MODEL_DRAG_TYPE,
  SCENE_TEXT_DRAG_TYPE,
  SCENE_SENSOR_DRAG_TYPE,
};
