import { useCallback, useEffect, useRef, useState } from 'react';
import { Object3D, Quaternion } from 'three';
import type { TransformControls as TransformControlsImpl } from 'three-stdlib';
import { degToRad, modelObjectRegistry, parseMeshId } from '@crane/domain/3d';
import { getPlacementTransformVectors } from '../lib/transform-vectors';
import { orbitAroundPivot, scaleAboutPivot } from '../lib/pivot-transform';
import {
  readRootPlacement,
  snapChangedAxes,
  snapStepFor,
  useActiveTransformStore,
  writeRootPlacement,
  useIsMultiSelection,
  useSceneObjectSelectionStore,
  type SceneSnapStep,
  type SceneTransformField,
  type SceneTransformMode,
  type SceneTransformPivot,
} from '@crane/features/3d';
import type { Vector3Tuple } from '@crane/core/types/math';

const FIELD_OF_MODE: Record<SceneTransformMode, SceneTransformField> = {
  translate: 'position',
  rotate: 'rotation',
  scale: 'scale',
};

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

/** 드래그 시작 시점의 각 객체 transform 스냅샷. */
interface DragStartTransform {
  position: Vector3Tuple;
  quaternion: Quaternion;
  /** 시작 오일러(deg, sceneInfo 표현). 스냅의 "변한 축" 판정 기준. */
  rotationDeg: Vector3Tuple;
  scale: Vector3Tuple;
}

// liveSync는 매 frame 호출되므로 임시 Quaternion을 재사용해 할당을 피한다.
const tmpStartQuatInv = new Quaternion();
const tmpDeltaQuat = new Quaternion();
// 스냅 되쓰기용 배치 자세 스크래치(readRootPlacement → 격자 → writeRootPlacement).
const snapPose = new Object3D();
// 피벗 변형에서 세컨더리 위치를 배치 프레임으로 써넣을 때의 스크래치.
const pivotPose = new Object3D();

interface UseSceneTransformParams {
  primarySelectedId: string | null;
  transformMode: SceneTransformMode;
  sceneModels: { id: string }[] | undefined;
  sceneTexts?: { id: string }[] | undefined;
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
    updates: Array<{
      id: string;
      position?: Vector3Tuple;
      rotation?: Vector3Tuple;
      scale?: Vector3Tuple;
    }>,
  ) => void;
  onTransformInteractionStart?: () => void;
  onTransformInteractionEnd?: () => void;
  /** 기즈모 스냅. 켜져 있으면 liveSync 가 저장값(부모 프레임) 기준 격자로 옮긴다. */
  snapEnabled?: boolean;
  snapStep?: SceneSnapStep;
  /**
   * 다중 선택 회전·크기의 기준점. `primary` 면 프라이머리 배치 위치를 피벗으로
   * 세컨더리 위치를 궤도 이동시켜 선택 전체가 강체처럼 움직인다.
   */
  transformPivot?: SceneTransformPivot;
}

export function useSceneTransform({
  primarySelectedId,
  transformMode,
  sceneModels,
  sceneTexts,
  sceneMaps,
  modelObjectRegistryRef,
  onTransformVectorChange,
  onTransformCommit,
  onMultiTransformCommit,
  onTransformInteractionStart,
  onTransformInteractionEnd,
  snapEnabled = false,
  snapStep,
  transformPivot = 'individual',
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

  const dragStartTransformsRef = useRef<Map<string, DragStartTransform>>(
    new Map(),
  );
  // 드래그 세션 동안의 오일러 연속성 기준(deg). three의 euler 추출은 y>90°
  // 자세를 플립된 표현(x/z ±180)으로 내므로, 직전에 보정된 값을 기준으로
  // 등가 표현 중 연속인 쪽을 고른다. 드래그가 끝나면 반드시 비운다 —
  // stale 기준으로 다음 드래그를 보정하면 안 된다.
  const rotationContinuityRef = useRef<Map<string, Vector3Tuple>>(new Map());
  const dragJustEndedRef = useRef(false);

  const isMultiDrag = isMultiSelection;

  // 현재 모드 채널의 스냅 단위(저장값 단위: m · deg · 배율). 0 이면 스냅 없음.
  const snapStepValue =
    snapEnabled && snapStep
      ? snapStepFor(FIELD_OF_MODE[transformMode], snapStep)
      : 0;

  /**
   * Object3D 의 현재 transform 을 sceneInfo 표현(**배치값**, 태그 Δ 를 벗긴 것)
   * 으로 읽고, 스냅이 켜져 있으면 드래그 시작 대비 **변한 축만** 격자로 옮긴
   * 뒤 Δ 를 다시 더해 Object3D 에 되써 넣는다. 격자는 저장값(부모 프레임 위치 ·
   * 오일러 deg · 배율) 위에 놓인다 — three 의 `translationSnap` 은 local
   * 공간에서 객체의 회전 프레임에 격자를 놓아 yaw 로 돌아간 모델의 X·Z
   * 저장값이 정수가 되지 않았다(snap-transform 주석 참고). TransformControls
   * 는 pointermove 마다 start+offset 으로 다시 계산하므로 되써 넣어도 누적
   * 오차가 없다.
   */
  const readSnappedTransform = useCallback(
    (
      id: string,
      obj: Object3D,
      start: DragStartTransform | undefined,
      prevRotationDeg: Vector3Tuple | undefined,
    ): Record<SceneTransformField, Vector3Tuple> => {
      const vectors = getPlacementTransformVectors(id, obj, prevRotationDeg);
      if (snapStepValue <= 0 || !start) return vectors;

      let next = vectors;
      if (transformMode === 'translate') {
        const position = snapChangedAxes(
          start.position,
          vectors.position,
          snapStepValue,
        );
        if (position === vectors.position) return vectors;
        next = { ...vectors, position };
      } else if (transformMode === 'rotate') {
        const rotation = snapChangedAxes(
          start.rotationDeg,
          vectors.rotation,
          snapStepValue,
        );
        if (rotation === vectors.rotation) return vectors;
        next = { ...vectors, rotation };
      } else {
        // scale: 격자 0 은 행렬을 망가뜨리므로 three 와 같이 한 칸으로 올린다.
        const scale = snapChangedAxes(
          start.scale,
          vectors.scale,
          snapStepValue,
        ).map((v) => (v === 0 ? snapStepValue : v)) as Vector3Tuple;
        if (scale.every((v, i) => v === vectors.scale[i])) return vectors;
        next = { ...vectors, scale };
      }

      // 스냅한 채널만 배치 자세에 반영하고 Δ 를 다시 더해 화면 자세로.
      readRootPlacement(id, obj, snapPose);
      if (transformMode === 'translate') {
        snapPose.position.set(...next.position);
      } else if (transformMode === 'rotate') {
        snapPose.rotation.set(
          degToRad(next.rotation[0]),
          degToRad(next.rotation[1]),
          degToRad(next.rotation[2]),
        );
      } else {
        snapPose.scale.set(...next.scale);
      }
      writeRootPlacement(id, obj, snapPose);
      return next;
    },
    [snapStepValue, transformMode],
  );

  /**
   * 세컨더리의 **배치** 위치를 써넣는다 — 루트 위치 태그 맵핑 Δ 가 있는 모델은
   * Object3D.position 이 rest+Δ 라 직접 대입하면 Δ 가 저장값에 흡수된다.
   * readSnappedTransform 의 되쓰기와 같은 경로(readRootPlacement → 수정 →
   * writeRootPlacement)를 쓴다.
   */
  const writePlacementPosition = useCallback(
    (id: string, obj: Object3D, position: Vector3Tuple) => {
      readRootPlacement(id, obj, pivotPose);
      pivotPose.position.set(position[0], position[1], position[2]);
      writeRootPlacement(id, obj, pivotPose);
    },
    [],
  );

  /**
   * 매 frame TransformControls.onObjectChange에서 호출.
   *
   * **sceneInfo write 절대 없음.** Object3D는 TransformControls가 이미 mutate
   * 했고, 우리는 그 결과를 (스냅 적용 후) transient store로 publish만 한다
   * (Inspector 표시용). Multi-drag일 경우 다른 선택 객체들의 Object3D만 직접
   * mutate (시각 피드백).
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

    // 프라이머리를 먼저 스냅해야 세컨더리가 받는 델타도 격자 기준이 된다.
    const start = dragStartTransformsRef.current.get(primarySelectedId);
    const nextTransform = readSnappedTransform(
      primarySelectedId,
      selectedObject,
      start,
      rotationContinuityRef.current.get(primarySelectedId),
    );
    rotationContinuityRef.current.set(
      primarySelectedId,
      nextTransform.rotation,
    );

    if (isMultiDrag && start) {
      const selectedIds = useSceneObjectSelectionStore.getState().selectedIds;

      if (transformMode === 'translate') {
        const deltaX = selectedObject.position.x - start.position[0];
        const deltaY = selectedObject.position.y - start.position[1];
        const deltaZ = selectedObject.position.z - start.position[2];

        // Apply delta to all other selected objects' Object3D directly (visual feedback)
        for (const id of selectedIds) {
          if (id === primarySelectedId) continue;
          const obj = modelObjectRegistryRef.current.get(id);
          const objStart = dragStartTransformsRef.current.get(id);
          if (!obj || !objStart) continue;

          obj.position.set(
            objStart.position[0] + deltaX,
            objStart.position[1] + deltaY,
            objStart.position[2] + deltaZ,
          );
          // 시작이 격자 밖이던 세컨더리도 각자 자기 시작값 기준으로 격자에 올린다.
          readSnappedTransform(
            id,
            obj,
            objStart,
            rotationContinuityRef.current.get(id),
          );
        }
      } else if (transformMode === 'rotate') {
        // 프라이머리의 부모 프레임 회전 델타를 각 객체에 premultiply 하면 모두
        // 같은 축 방향으로 돈다. 피벗이 individual 이면 여기서 끝(제자리
        // 회전). primary 면 위치까지 프라이머리 시작 배치 위치를 중심으로
        // 궤도 이동시켜 선택 전체가 강체처럼 돈다 — 이때 세컨더리는 개별
        // 스냅하지 않는다. 프라이머리가 먼저 스냅돼 델타가 이미 격자
        // 기준이고, 각자 오일러 격자에 올리면 강체성이 깨진다.
        tmpStartQuatInv.copy(start.quaternion).invert();
        tmpDeltaQuat.copy(selectedObject.quaternion).multiply(tmpStartQuatInv);
        const orbitPivot = transformPivot === 'primary';

        for (const id of selectedIds) {
          if (id === primarySelectedId) continue;
          const obj = modelObjectRegistryRef.current.get(id);
          const objStart = dragStartTransformsRef.current.get(id);
          if (!obj || !objStart) continue;

          obj.quaternion.copy(tmpDeltaQuat).multiply(objStart.quaternion);
          if (orbitPivot) {
            writePlacementPosition(
              id,
              obj,
              orbitAroundPivot(objStart.position, start.position, tmpDeltaQuat),
            );
            continue;
          }
          readSnappedTransform(
            id,
            obj,
            objStart,
            rotationContinuityRef.current.get(id),
          );
        }
      } else {
        // scale: 프라이머리의 성분별 비율을 각 객체의 시작 스케일에 곱한다.
        // 시작 성분이 0이면 비율을 정의할 수 없으므로 1로 둔다.
        const ratioX =
          start.scale[0] === 0 ? 1 : selectedObject.scale.x / start.scale[0];
        const ratioY =
          start.scale[1] === 0 ? 1 : selectedObject.scale.y / start.scale[1];
        const ratioZ =
          start.scale[2] === 0 ? 1 : selectedObject.scale.z / start.scale[2];
        // primary 피벗이면 위치도 같은 비율로 벌린다(회전 분기와 같은 이유로
        // 세컨더리 개별 스냅은 건너뛴다).
        const scalePivot = transformPivot === 'primary';

        for (const id of selectedIds) {
          if (id === primarySelectedId) continue;
          const obj = modelObjectRegistryRef.current.get(id);
          const objStart = dragStartTransformsRef.current.get(id);
          if (!obj || !objStart) continue;

          obj.scale.set(
            objStart.scale[0] * ratioX,
            objStart.scale[1] * ratioY,
            objStart.scale[2] * ratioZ,
          );
          if (scalePivot) {
            writePlacementPosition(
              id,
              obj,
              scaleAboutPivot(objStart.position, start.position, [
                ratioX,
                ratioY,
                ratioZ,
              ]),
            );
            continue;
          }
          readSnappedTransform(
            id,
            obj,
            objStart,
            rotationContinuityRef.current.get(id),
          );
        }
      }
    }

    useActiveTransformStore
      .getState()
      .publish(
        nextTransform.position,
        nextTransform.rotation,
        nextTransform.scale,
      );
  }, [
    primarySelectedId,
    selectedObject,
    isMultiDrag,
    transformMode,
    transformPivot,
    modelObjectRegistryRef,
    readSnappedTransform,
    writePlacementPosition,
  ]);

  /**
   * mouseUp에서 단 1회 호출. selectedObject의 최종 transform을 sceneInfo로
   * commit한다. 기존 sceneInfo write 흐름(`onTransformVectorChange` 3회)
   * 과 동일하지만 매 frame이 아니라 손을 뗀 시점에만 발화.
   */
  const commitFinal = useCallback(() => {
    if (!selectedObject || !primarySelectedId) {
      return;
    }
    // liveSync가 프레임마다 갱신해 둔 연속성 기준으로 최종 euler를 보정한다
    // (onObjectChange 없이 mouseUp만 오는 경로도 드래그 시작 seed로 보정된다).
    // 배치값(태그 Δ 를 벗긴 값)으로 저장한다 — 절대 자세를 저장하면 드라이버가
    // Δ 를 한 번 더 더해 모델이 Δ 만큼 더 가서 멈춘다.
    const nextTransform = getPlacementTransformVectors(
      primarySelectedId,
      selectedObject,
      rotationContinuityRef.current.get(primarySelectedId),
    );
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
  }, [
    onTransformCommit,
    onTransformVectorChange,
    primarySelectedId,
    selectedObject,
    transformMode,
  ]);

  // 기존 호출부 호환을 위한 별칭. canvas의 <TransformControls onObjectChange>가
  // 이 이름을 사용한다. Live sync(매 frame, store만)가 새 의미.
  const syncSelectedObjectTransform = liveSync;

  const handleTransformMouseDown = useCallback(() => {
    setIsTransformDragging(true);
    onTransformInteractionStart?.();
    // 드래그 진입: transient store 활성화. Inspector가 store 값을 표시하기 시작.
    useActiveTransformStore.getState().begin();

    // 단일 선택 포함 전 선택 객체의 시작 transform을 기록한다. 멀티 드래그의
    // 델타 기준이자, 오일러 연속성 보정의 seed(드래그 시작 euler deg)가 된다.
    // 위치·오일러·크기는 배치값(태그 Δ 를 벗긴 것)으로 둔다 — 스냅의 "변한 축"
    // 비교 기준이 커밋값과 같아야 한다. quaternion 은 절대 자세 그대로다:
    // 멀티 드래그 회전 델타 `current ∘ start⁻¹` 에서 Δ 가 상쇄되기 때문.
    const selectedIds = useSceneObjectSelectionStore.getState().selectedIds;
    const startTransforms = new Map<string, DragStartTransform>();
    const continuityRotations = new Map<string, Vector3Tuple>();
    for (const id of selectedIds) {
      // 모델/텍스트는 캔버스 로컬 ref에, mesh는 도메인 전역 registry에 있다.
      const obj =
        modelObjectRegistryRef.current.get(id) ?? modelObjectRegistry.get(id);
      if (obj) {
        const placement = getPlacementTransformVectors(id, obj);
        startTransforms.set(id, {
          position: placement.position,
          quaternion: obj.quaternion.clone(),
          rotationDeg: placement.rotation,
          scale: placement.scale,
        });
        continuityRotations.set(id, placement.rotation);
      }
    }
    dragStartTransformsRef.current = startTransforms;
    rotationContinuityRef.current = continuityRotations;
  }, [onTransformInteractionStart, modelObjectRegistryRef]);

  const handleTransformMouseUp = useCallback(() => {
    if (isMultiDrag && selectedObject && primarySelectedId) {
      // liveSync가 이미 각 Object3D를 최종 상태로 mutate했으므로 현재 값을
      // 그대로 읽어 commit한다. commitFinal과 같은 이유로 transformMode에
      // 해당하는 필드만 담는다 (rad↔deg 왕복 오차로 다른 필드가 덮이는 것 방지).
      // 예외: primary 피벗의 회전·크기는 세컨더리 위치가 실제로 바뀌므로
      // position 도 함께 담는다. 프라이머리는 위치 불변이라 제외한다.
      const orbitedSecondary =
        transformPivot === 'primary' && transformMode !== 'translate';
      const updates: Array<{
        id: string;
        position?: Vector3Tuple;
        rotation?: Vector3Tuple;
        scale?: Vector3Tuple;
      }> = [];
      const selectedIds = useSceneObjectSelectionStore.getState().selectedIds;
      for (const id of selectedIds) {
        if (!dragStartTransformsRef.current.has(id)) continue;
        const obj =
          id === primarySelectedId
            ? selectedObject
            : modelObjectRegistryRef.current.get(id);
        if (!obj) continue;

        // 세컨더리 객체는 프레임별 보정 없이 드래그 시작 seed 기준으로
        // 1회 보정한다 — 플립 등가표현은 누적이 아니라 정확한 쌍이므로
        // 시작 대비 어느 표현이 연속인지는 seed만으로 판정된다.
        const nextTransform = getPlacementTransformVectors(
          id,
          obj,
          rotationContinuityRef.current.get(id),
        );
        const orbited = orbitedSecondary && id !== primarySelectedId;
        if (transformMode === 'translate') {
          updates.push({ id, position: nextTransform.position });
        } else if (transformMode === 'rotate') {
          updates.push({
            id,
            rotation: nextTransform.rotation,
            ...(orbited && { position: nextTransform.position }),
          });
        } else {
          updates.push({
            id,
            scale: nextTransform.scale,
            ...(orbited && { position: nextTransform.position }),
          });
        }
      }

      onMultiTransformCommit?.(updates);
    } else {
      // single-object: 최종 transform을 sceneInfo로 commit (history 1단계 생성)
      commitFinal();
    }

    // 드래그 세션 종료 — 시작 스냅샷과 연속성 기준을 모두 비운다.
    dragStartTransformsRef.current.clear();
    rotationContinuityRef.current.clear();

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
    transformMode,
    transformPivot,
    modelObjectRegistryRef,
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

    // 모델 안쪽 노드(`${modelId}::${meshPath}`) 선택은 읽기 전용이다 — 바운딩
    // 박스만 그리고 기즈모는 붙이지 않는다. 대상을 비워 두면 아래 detach
    // effect 가 컨트롤을 뗀다.
    if (parseMeshId(primarySelectedId)) {
      setSelectedObject(null);
      setIsTransformDragging(false);
      return;
    }

    const isSelectedPresent =
      (sceneModels?.some((model) => model.id === primarySelectedId) ?? false) ||
      (sceneTexts?.some((t) => t.id === primarySelectedId) ?? false) ||
      (sceneMaps?.some((m) => m.id === primarySelectedId) ?? false);

    if (!isSelectedPresent) {
      setSelectedObject(null);
      setIsTransformDragging(false);
      modelObjectRegistryRef.current.delete(primarySelectedId);
      return;
    }

    // 캔버스의 로컬 ref 를 우선 쓰고 도메인 전역 registry 로 fallback 한다.
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
      // mouseUp 없이 selection이 바뀌는 경로에서도 드래그 세션 상태를 비운다.
      dragStartTransformsRef.current.clear();
      rotationContinuityRef.current.clear();
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
