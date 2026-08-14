import React, {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Box3, Vector3, type Camera, type WebGLRenderer } from 'three';
import type { Object3D } from 'three';

const DRAG_THRESHOLD_PX = 5;
const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>();

interface NormalizedRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

function normalizeRect(
  a: { x: number; y: number },
  b: { x: number; y: number },
): NormalizedRect {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function getBox3Corners(box: Box3): Vector3[] {
  const { min, max } = box;
  return [
    new Vector3(min.x, min.y, min.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3(min.x, max.y, min.z),
    new Vector3(max.x, max.y, min.z),
    new Vector3(min.x, min.y, max.z),
    new Vector3(max.x, min.y, max.z),
    new Vector3(min.x, max.y, max.z),
    new Vector3(max.x, max.y, max.z),
  ];
}

function computeMarqueeSelection(
  screenRect: NormalizedRect,
  registry: Map<string, Object3D>,
  camera: Camera,
  renderer: WebGLRenderer,
  excludedIds: ReadonlySet<string>,
): string[] {
  const canvasRect = renderer.domElement.getBoundingClientRect();
  const result: string[] = [];

  // pointerup은 render loop 밖 DOM 이벤트이므로 행렬을 최신화
  camera.updateMatrixWorld(true);

  for (const [id, object] of registry) {
    // 지도는 마퀴에서 제외한다. 지형 AABB가 씬 전체를 덮어 어떤 마퀴든
    // 반드시 걸리고, 그대로 그룹 드래그하면 지형이 통째로 딸려 간다.
    // 지도는 클릭 또는 좌측 패널로만 선택한다.
    if (excludedIds.has(id)) continue;

    // 오브젝트 world 행렬도 최신화
    object.updateWorldMatrix(true, false);

    const worldBox = new Box3().setFromObject(object);
    if (worldBox.isEmpty()) continue;

    const corners = getBox3Corners(worldBox);
    let minSX = Infinity;
    let minSY = Infinity;
    let maxSX = -Infinity;
    let maxSY = -Infinity;

    for (const corner of corners) {
      const ndc = corner.clone().project(camera);
      // 카메라 뒤 코너는 투영값이 반전되므로 스킵
      if (ndc.z > 1.0) continue;

      const sx = ((ndc.x + 1) / 2) * canvasRect.width + canvasRect.left;
      const sy = ((-ndc.y + 1) / 2) * canvasRect.height + canvasRect.top;
      minSX = Math.min(minSX, sx);
      minSY = Math.min(minSY, sy);
      maxSX = Math.max(maxSX, sx);
      maxSY = Math.max(maxSY, sy);
    }

    // 유효한 코너가 하나도 없으면 스킵
    if (minSX === Infinity) continue;

    const overlaps =
      minSX < screenRect.right &&
      maxSX > screenRect.left &&
      minSY < screenRect.bottom &&
      maxSY > screenRect.top;

    if (overlaps) {
      result.push(id);
    }
  }

  return result;
}

interface UseMarqueeSelectionParams {
  cameraRef: RefObject<Camera | null>;
  rendererRef: RefObject<WebGLRenderer | null>;
  modelObjectRegistryRef: RefObject<Map<string, Object3D>>;
  isTransformDragging: boolean;
  dragJustEndedRef: RefObject<boolean>;
  isDraggingExternalItem: boolean;
  /** 마퀴 선택에서 제외할 id (지도 등). */
  excludedIds?: ReadonlySet<string>;
  selectAll: (ids: string[]) => void;
  clearSelectedModel: () => void;
}

interface UseMarqueeSelectionReturn {
  marqueeStyle: CSSProperties;
  isMarqueeActive: boolean;
  /** 루트 컨테이너 div에 ref로 부착해야 이벤트가 등록됩니다 */
  marqueeContainerRef: (el: HTMLDivElement | null) => void;
  /** marquee 드래그 직후 true — onPointerMissed 등에서 선택 해제 방지용 */
  marqueeJustEndedRef: React.RefObject<boolean>;
}

export function useMarqueeSelection({
  cameraRef,
  rendererRef,
  modelObjectRegistryRef,
  isTransformDragging,
  dragJustEndedRef,
  isDraggingExternalItem,
  excludedIds,
  selectAll,
  clearSelectedModel,
}: UseMarqueeSelectionParams): UseMarqueeSelectionReturn {
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const marqueeJustEndedRef = useRef(false);
  const [marqueeRect, setMarqueeRect] = useState<NormalizedRect | null>(null);

  // 최신 rect를 pointerup 핸들러에서 동기적으로 읽기 위한 ref
  const marqueeRectRef = useRef<NormalizedRect | null>(null);
  marqueeRectRef.current = marqueeRect;

  // 최신 값들을 ref로 동기화 (핸들러 클로저 stale 방지)
  const isTransformDraggingRef = useRef(isTransformDragging);
  isTransformDraggingRef.current = isTransformDragging;

  const isDraggingExternalItemRef = useRef(isDraggingExternalItem);
  isDraggingExternalItemRef.current = isDraggingExternalItem;

  const selectAllRef = useRef(selectAll);
  selectAllRef.current = selectAll;

  const clearSelectedModelRef = useRef(clearSelectedModel);
  clearSelectedModelRef.current = clearSelectedModel;

  const excludedIdsRef = useRef(excludedIds);
  excludedIdsRef.current = excludedIds;

  const isSpacePressedRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') isSpacePressedRef.current = true; };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') isSpacePressedRef.current = false; };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.button !== 0) return;
    if (isTransformDraggingRef.current) return;
    if (isDraggingExternalItemRef.current) return;
    if (isSpacePressedRef.current) return;

    startPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!startPosRef.current) return;

    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;

    if (!isDraggingRef.current) {
      if (
        Math.abs(dx) < DRAG_THRESHOLD_PX &&
        Math.abs(dy) < DRAG_THRESHOLD_PX
      ) {
        return;
      }
      isDraggingRef.current = true;
    }

    const rect = normalizeRect(startPosRef.current, {
      x: e.clientX,
      y: e.clientY,
    });
    setMarqueeRect(rect);
  }, []);

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (e.button !== 0) return;

      const wasDragging = isDraggingRef.current;
      const savedRect = marqueeRectRef.current;

      startPosRef.current = null;
      isDraggingRef.current = false;
      setMarqueeRect(null);

      if (!wasDragging || !savedRect) return;

      // TransformControls 드래그 직후 오발 방지
      if (dragJustEndedRef.current) return;

      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      const registry = modelObjectRegistryRef.current;

      if (!camera || !renderer) return;

      const selected = computeMarqueeSelection(
        savedRect,
        registry,
        camera,
        renderer,
        excludedIdsRef.current ?? EMPTY_ID_SET,
      );

      // onPointerMissed가 이 직후 발화해서 선택을 지우는 것을 방지
      marqueeJustEndedRef.current = true;
      setTimeout(() => {
        marqueeJustEndedRef.current = false;
      }, 100);

      if (selected.length === 0) {
        clearSelectedModelRef.current();
      } else {
        selectAllRef.current(selected);
      }
    },
    [cameraRef, dragJustEndedRef, modelObjectRegistryRef, rendererRef],
  );

  const handlePointerCancel = useCallback(() => {
    startPosRef.current = null;
    isDraggingRef.current = false;
    setMarqueeRect(null);
  }, []);

  // pointerup/cancel은 드래그 중 컨테이너 밖으로 나가도 받을 수 있도록 document에 등록
  useEffect(() => {
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [handlePointerUp, handlePointerCancel]);

  // ref callback: pointerdown/move는 컨테이너에만 등록 (다른 UI 영역 드래그 무시)
  const marqueeContainerRef = useCallback(
    (el: HTMLDivElement | null) => {
      const prev = containerElRef.current;
      if (prev) {
        prev.removeEventListener('pointerdown', handlePointerDown);
        prev.removeEventListener('pointermove', handlePointerMove);
      }

      containerElRef.current = el;

      if (el) {
        el.addEventListener('pointerdown', handlePointerDown);
        el.addEventListener('pointermove', handlePointerMove);
      }
    },
    [handlePointerDown, handlePointerMove],
  );

  const marqueeStyle: CSSProperties = (() => {
    if (!marqueeRect) return { display: 'none' };
    const containerEl = containerElRef.current;
    if (!containerEl) return { display: 'none' };
    const containerDomRect = containerEl.getBoundingClientRect();
    return {
      position: 'absolute',
      left: marqueeRect.left - containerDomRect.left,
      top: marqueeRect.top - containerDomRect.top,
      width: marqueeRect.width,
      height: marqueeRect.height,
    };
  })();

  return {
    marqueeStyle,
    isMarqueeActive: marqueeRect !== null,
    marqueeContainerRef,
    marqueeJustEndedRef,
  };
}
