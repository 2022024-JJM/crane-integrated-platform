import { useCallback, useEffect, useRef, useState } from 'react';
import { Object3D } from 'three';
import type { TransformControls as TransformControlsImpl } from 'three-stdlib';
import {
  numRound,
  radToDeg,
  modelObjectRegistry,
  parseMeshId,
} from '@crane/domain/3d';
import {
  useActiveTransformStore,
  useIsMultiSelection,
  useSceneObjectSelectionStore,
  type SceneTransformField,
  type SceneTransformMode,
} from '@crane/features/3d';
import type { Vector3Tuple } from '@crane/core/types/math';

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
  primarySelectedId: string | null;
  transformMode: SceneTransformMode;
  sceneModels: { id: string }[] | undefined;
  sceneTexts?: { id: string }[] | undefined;
  sceneSensors?: { id: string }[] | undefined;
  /** 잠금 해제된 지도만 넘어온다 — 잠긴 지도는 애초에 선택될 수 없다. */
  sceneMaps?: { id: string }[] | undefined;
  modelObjectRegistryRef: React.RefObject<Map<string, Object3D>>;
  onTransformVectorChange: (
    field: SceneTransformField,
    value: Vector3Tuple,
  ) => void;
  onTransformCommit?: (
    position: Vector3Tuple | null,
    rotation: Vector3Tuple | null,
    scale: Vector3Tuple | null,
  ) => void;
  onMultiTransformCommit?: (
    updates: Array<{ id: string; position: Vector3Tuple }>,
  ) => void;
  onTransformInteractionStart?: () => void;
  onTransformInteractionEnd?: () => void;
}

export function useSceneTransform({
  primarySelectedId,
  transformMode,
  sceneModels,
  sceneTexts,
  sceneSensors,
  sceneMaps,
  modelObjectRegistryRef,
  onTransformVectorChange,
  onTransformCommit,
  onMultiTransformCommit,
  onTransformInteractionStart,
  onTransformInteractionEnd,
}: UseSceneTransformParams) {
  // selectedIds 자체를 구독하면 어떤 객체 하나만 선택해도 Set 참조가 바뀌며
  // 이 hook을 사용하는 캔버스 전체가 리렌더된다. 대신 boolean(다중 여부)만
  // 구독하고, 콜백 안에서는 store.getState()로 즉시 fetch 한다.
  const isMultiSelection = useIsMultiSelection();
  const orbitControlsRef = useRef<import('three-stdlib').OrbitControls | null>(
    null,
  );
  const transformControlsRef = useRef<TransformControlsImpl | null>(null);
  const [selectedObject, setSelectedObject] = useState<Object3D | null>(null);
  const [isTransformDragging, setIsTransformDragging] = useState(false);

  const dragStartPositionsRef = useRef<Map<string, Vector3Tuple>>(new Map());
  const dragJustEndedRef = useRef(false);

  const isMultiDrag = isMultiSelection && transformMode === 'translate';

  /**
   * 매 frame TransformControls.onObjectChange에서 호출.
   *
   * **sceneInfo write 절대 없음.** Object3D는 TransformControls가 이미 mutate
   * 했고, 우리는 그 결과를 transient store로 publish만 한다 (Inspector 표시용).
   * Multi-drag일 경우 다른 선택 객체들의 Object3D만 직접 mutate (시각 피드백).
   *
   * sceneInfo가 매 frame 안 변하므로:
   *  - ModelMesh meshOverrides effect 재실행 없음 → scale 폭주 없음
   *  - <Gltf position={...}> prop reconcile 없음 → 노란 박스 추격 지연 없음
   *  - palette/canvas 리렌더 없음
   */
  const liveSync = useCallback(() => {
    if (!selectedObject || !primarySelectedId) {
      return;
    }

    if (isMultiDrag) {
      // Compute delta from primary object's start position
      const startPos = dragStartPositionsRef.current.get(primarySelectedId);
      if (!startPos) return;

      const deltaX = selectedObject.position.x - startPos[0];
      const deltaY = selectedObject.position.y - startPos[1];
      const deltaZ = selectedObject.position.z - startPos[2];

      // Apply delta to all other selected objects' Object3D directly (visual feedback)
      const selectedIds = useSceneObjectSelectionStore.getState().selectedIds;
      for (const id of selectedIds) {
        if (id === primarySelectedId) continue;
        const obj = modelObjectRegistryRef.current.get(id);
        const objStartPos = dragStartPositionsRef.current.get(id);
        if (!obj || !objStartPos) continue;

        obj.position.set(
          objStartPos[0] + deltaX,
          objStartPos[1] + deltaY,
          objStartPos[2] + deltaZ,
        );
      }
    }

    const nextTransform = getObjectTransformVectors(selectedObject);
    useActiveTransformStore
      .getState()
      .publish(
        nextTransform.position,
        nextTransform.rotation,
        nextTransform.scale,
      );
  }, [primarySelectedId, selectedObject, isMultiDrag, modelObjectRegistryRef]);

  /**
   * mouseUp에서 단 1회 호출. selectedObject의 최종 transform을 sceneInfo로
   * commit한다. 기존 sceneInfo write 흐름(`onTransformVectorChange` 3회)
   * 과 동일하지만 매 frame이 아니라 손을 뗀 시점에만 발화.
   */
  const commitFinal = useCallback(() => {
    if (!selectedObject || !primarySelectedId) {
      return;
    }
    const nextTransform = getObjectTransformVectors(selectedObject);
    if (onTransformCommit) {
      // position/rotation/scale을 단일 updateSceneInfo 호출로 처리해
      // 중간 렌더 없이 sceneInfo를 1회만 변경한다.
      // transformMode에 따라 실제 변경된 필드만 commit — translate 모드에서
      // rotation/scale을 radToDeg로 역변환하면 부동소수점 오차로 값이 미묘하게
      // 달라져 다음 렌더에서 rotation prop이 업데이트되며 local space 기준축이
      // 틀어지는 버그가 생긴다.
      onTransformCommit(
        transformMode === 'translate' ? nextTransform.position : null,
        transformMode === 'rotate' ? nextTransform.rotation : null,
        transformMode === 'scale' ? nextTransform.scale : null,
      );
    } else {
      if (transformMode === 'translate') {
        onTransformVectorChange('position', nextTransform.position);
      } else if (transformMode === 'rotate') {
        onTransformVectorChange('rotation', nextTransform.rotation);
      } else if (transformMode === 'scale') {
        onTransformVectorChange('scale', nextTransform.scale);
      }
    }
  }, [onTransformCommit, onTransformVectorChange, primarySelectedId, selectedObject, transformMode]);

  // 기존 호출부 호환을 위한 별칭. canvas의 <TransformControls onObjectChange>가
  // 이 이름을 사용한다. Live sync(매 frame, store만)가 새 의미.
  const syncSelectedObjectTransform = liveSync;

  const handleTransformMouseDown = useCallback(() => {
    setIsTransformDragging(true);
    onTransformInteractionStart?.();
    // 드래그 진입: transient store 활성화. Inspector가 store 값을 표시하기 시작.
    useActiveTransformStore.getState().begin();

    // Capture start positions of all selected objects for multi-drag
    const selectedIds = useSceneObjectSelectionStore.getState().selectedIds;
    if (selectedIds.size > 1 && transformMode === 'translate') {
      const startPositions = new Map<string, Vector3Tuple>();
      for (const id of selectedIds) {
        const obj = modelObjectRegistryRef.current.get(id);
        if (obj) {
          startPositions.set(id, [obj.position.x, obj.position.y, obj.position.z]);
        }
      }
      dragStartPositionsRef.current = startPositions;
    }
  }, [onTransformInteractionStart, transformMode, modelObjectRegistryRef]);

  const handleTransformMouseUp = useCallback(() => {
    if (isMultiDrag && selectedObject && primarySelectedId) {
      // Compute final positions for all selected objects and commit
      const startPos = dragStartPositionsRef.current.get(primarySelectedId);
      if (startPos) {
        const deltaX = selectedObject.position.x - startPos[0];
        const deltaY = selectedObject.position.y - startPos[1];
        const deltaZ = selectedObject.position.z - startPos[2];

        const updates: Array<{ id: string; position: Vector3Tuple }> = [];
        const selectedIds = useSceneObjectSelectionStore.getState().selectedIds;
        for (const id of selectedIds) {
          const objStartPos = dragStartPositionsRef.current.get(id);
          if (!objStartPos) continue;

          updates.push({
            id,
            position: [
              objStartPos[0] + deltaX,
              objStartPos[1] + deltaY,
              objStartPos[2] + deltaZ,
            ],
          });
        }

        onMultiTransformCommit?.(updates);
      }

      dragStartPositionsRef.current.clear();
    } else {
      // single-object: 최종 transform을 sceneInfo로 commit (history 1단계 생성)
      commitFinal();
    }

    // 드래그 종료: transient store 해제. Inspector는 다음 frame부터 sceneInfo
    // (방금 commit된 값)를 표시한다.
    useActiveTransformStore.getState().end();

    setIsTransformDragging(false);
    onTransformInteractionEnd?.();

    // 드래그 직후 발화되는 R3F click 이벤트로 인해 선택이 바뀌는 것을 방지.
    // state 업데이트는 re-render 후 반영되므로 ref로 동기적으로 표시한다.
    dragJustEndedRef.current = true;
    requestAnimationFrame(() => {
      dragJustEndedRef.current = false;
    });
  }, [
    isMultiDrag,
    selectedObject,
    primarySelectedId,
    onMultiTransformCommit,
    commitFinal,
    onTransformInteractionEnd,
  ]);

  useEffect(() => {
    const controls = orbitControlsRef.current;
    if (!controls) {
      return;
    }

    // 기즈모 드래그 중에는 orbit을 끈다. 이때 감쇠(damping)가 켜져 있으면
    // 남아 있던 회전 관성이 얼어붙었다가 드래그가 끝나는 순간 되살아나,
    // 정밀 배치를 막 끝낸 직후에 카메라가 저절로 돌아간다.
    //
    // 관성을 확실히 없앤다: three-stdlib는 damping이 **꺼져 있을 때만**
    // update()에서 sphericalDelta/panOffset을 0으로 리셋한다(켜져 있으면
    // 1-dampingFactor를 곱할 뿐이라 한 번 불러도 88%가 남는다). 그래서
    // 잠시 껐다가 update() 한 번으로 델타를 비우고 원래 값으로 되돌린다.
    if (isTransformDragging) {
      const previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = previousDamping;
      controls.enabled = false;
      return;
    }

    controls.enabled = true;
  }, [isTransformDragging, orbitControlsRef]);

  useEffect(() => {
    if (!primarySelectedId) {
      setSelectedObject(null);
      setIsTransformDragging(false);
      return;
    }

    // mesh selection: id가 `${modelId}::${meshPath}` 형식이면 부모 모델이
    // 존재하는지를 확인하고, 객체는 도메인 registry에서 가져온다.
    const meshIdInfo = parseMeshId(primarySelectedId);

    const isSelectedPresent = meshIdInfo
      ? (sceneModels?.some((model) => model.id === meshIdInfo.modelId) ?? false)
      : (sceneModels?.some((model) => model.id === primarySelectedId) ??
          false) ||
        (sceneTexts?.some((t) => t.id === primarySelectedId) ?? false) ||
        (sceneSensors?.some((s) => s.id === primarySelectedId) ?? false) ||
        (sceneMaps?.some((m) => m.id === primarySelectedId) ?? false);

    if (!isSelectedPresent) {
      setSelectedObject(null);
      setIsTransformDragging(false);
      modelObjectRegistryRef.current.delete(primarySelectedId);
      return;
    }

    // 모델/텍스트는 캔버스의 로컬 ref에서, mesh는 도메인 전역 registry에서
    // 우선 가져온다. 둘 다 fallback으로 검사.
    const nextSelectedObject =
      modelObjectRegistryRef.current.get(primarySelectedId) ??
      modelObjectRegistry.get(primarySelectedId) ??
      null;

    if (nextSelectedObject) {
      setSelectedObject(nextSelectedObject);
    }
  }, [
    sceneModels,
    sceneTexts,
    sceneSensors,
    sceneMaps,
    primarySelectedId,
    modelObjectRegistryRef,
  ]);

  useEffect(() => {
    const controls =
      transformControlsRef.current as TransformControlsWithDraggingEvent | null;
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

  // selection이 바뀌거나 사라질 때 transient store가 stale active 상태로
  // 남지 않도록 강제 cleanup. mouseUp을 정상 발화하지 못하는 어떤 경로
  // (예: 드래그 중 객체가 unmount, 키보드 esc, 다른 객체 클릭 등) 에서도
  // Inspector가 멈춰 보이지 않도록 보장한다.
  useEffect(() => {
    return () => {
      useActiveTransformStore.getState().end();
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
    dragJustEndedRef,
  };
}
