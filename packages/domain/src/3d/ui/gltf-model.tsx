import { memo, useCallback, useMemo } from 'react';
import { Object3D } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  ModelMesh,
  useClonedModel,
  useModelLabelLocalAnchor,
} from './model-mesh';
import { ModelLabel, type AlarmHighlightSeverity } from './model-label';
import { ModelSelectionBox } from './model-selection-box';
import { ObjectSilhouetteOutline } from './object-silhouette-outline';
import { SELECTION_LINE_COLOR } from '../lib/selection-style';
import type { SavedMeshOverride } from '../model/types';

interface GltfModelProps {
  id: string;
  url: string;
  equipName?: string;
  opacity?: number;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
  showLabel?: boolean;
  /**
   * 라벨 흐림 + 포인터 차단. 모니터링 포커스 중 포커스 밖 모델에 opacity 와
   * 함께 준다 — opacity 만으로는 라벨(DOM)이 또렷하고 클릭도 되기 때문.
   * 모델 자체의 반투명(opacity < 1)과는 무관하므로 별도 prop 이다.
   */
  labelDimmed?: boolean;
  alarmSeverity?: AlarmHighlightSeverity | null;
  alarmHighlightMesh?: boolean;
  /** 수면 아래를 깊이 안개로 흐리게 한다 — 바다 씬의 모델에만(model-mesh.tsx). */
  seaSubmersion?: boolean;
  /**
   * 그림자를 드리울지. 기본 true. 상세는 model-mesh.tsx의 같은 prop 주석 참고.
   */
  castShadow?: boolean;
  /** 그림자를 받을지. 기본 true. 컨텍스트 지형만 false — model-mesh.tsx 주석. */
  receiveShadow?: boolean;
  meshOverrides?: SavedMeshOverride[];
  /**
   * 클릭 hit-test 가속용 BVH를 빌드할지. 기본 true. bbox 존 분류만 하는
   * 자산 뷰어처럼 정밀 raycast가 필요 없는 곳만 false. 지도는 드롭/선택
   * raycast 대상이므로 기본값(true)을 쓴다 — model-mesh.tsx 주석 참고.
   */
  enableRaycastBvh?: boolean;
  /**
   * 모델/메시 선택 콜백. 두 번째 인자(event)는 R3F Canvas 안에서 모델 본체를
   * 클릭했을 때만 전달되며, 라벨 클릭처럼 DOM에서 호출되는 경우는 undefined.
   * 더블클릭/메시 path 계산 등 ThreeEvent가 필요한 분기는 event 유무로 구분.
   */
  onSelect?: (id: string, event?: ThreeEvent<MouseEvent>) => void;
  /** 더블클릭 시 별도 호출. drill-in (자식 mesh 선택) 트리거. */
  onDoubleSelect?: (id: string, event: ThreeEvent<MouseEvent>) => void;
  isSelected?: boolean;
  /**
   * 모델 전체 선택 표시 방식. 기본 'box'(AABB 라인). 'outline'은 충돌
   * 하이라이트와 같은 일체형 실루엣 테두리(ObjectSilhouetteOutline)로,
   * **캔버스에 스텐실 버퍼가 있어야 한다**(SCENE_GL_OPTIONS.stencil: true).
   * 스텐실 없는 캔버스(mro2·philly 존 뷰어 등)에서 켜면 헐이 모델을 통째로
   * 덮으므로 기본값을 바꾸지 않는다 — 씬 에디터만 'outline'을 넘긴다.
   * 자식 노드 선택(selectedMeshTarget)도 같은 실루엣으로 두르되 대상만 그
   * 노드 서브트리로 좁힌다 — 노드가 읽기 전용인 것과 표시 방식은 무관하다.
   */
  selectionStyle?: 'box' | 'outline';
  /**
   * 실루엣 테두리용 스무딩 사본을 워밍업 큐에서 미리 만들지(ModelMesh 로
   * 전달). 기본 false. 테두리가 그려질 수 있는 모델 — 에디터의 모델, 충돌
   * 감지가 도는 모니터링의 모델 — 만 켠다. 지도에는 켜지 않는다.
   */
  prepareOutline?: boolean;
  /**
   * 자식 노드가 선택된 경우 그 노드 객체. 선택 표시(실루엣 테두리 또는
   * 바운딩 박스)의 대상을 이 노드 서브트리로 좁힌다. null이면 모델 전체.
   */
  selectedMeshTarget?: Object3D | null;
  onObjectReady?: (id: string, object: Object3D | null) => void;
  /** event는 Canvas 안 3D 본체 hover에서만 전달 (라벨 등 DOM 호출은 undefined). */
  onHoverStart?: (
    id: string,
    clientX: number,
    clientY: number,
    event?: ThreeEvent<PointerEvent>,
  ) => void;
  onHoverMove?: (
    id: string,
    clientX: number,
    clientY: number,
    event?: ThreeEvent<PointerEvent>,
  ) => void;
  onHoverEnd?: (id: string) => void;
}

export const GltfModel = memo(function GltfModel({
  id,
  url,
  equipName,
  opacity = 1,
  seaSubmersion = false,
  castShadow = true,
  receiveShadow = true,
  showLabel = true,
  labelDimmed = false,
  alarmSeverity = null,
  alarmHighlightMesh = false,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  meshOverrides,
  onSelect,
  onDoubleSelect,
  isSelected = false,
  selectionStyle = 'box',
  prepareOutline = false,
  selectedMeshTarget = null,
  enableRaycastBvh = true,
  onObjectReady,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}: GltfModelProps) {
  // clone은 여기서 1회만 만들고 ModelMesh에 주입한다 — 예전엔 ModelMesh가
  // 따로 clone을 만들어 인스턴스당 clone·computeBoundingSphere가 2회 돌았고,
  // SelectionBox·라벨 앵커가 실제 렌더되는 트리와 다른 clone을 측정했다.
  const clonedModel = useClonedModel(url);
  const { clone } = clonedModel;
  const labelLocalAnchor = useModelLabelLocalAnchor(clone, showLabel);
  // 선택 표시 대상 — 자식 노드가 선택됐으면 그 노드, 아니면 모델 루트.
  // ObjectSilhouetteOutline 은 내부에서 node.uuid 를 key 로 인스턴스를 새로
  // 만들므로 대상이 바뀌어도 포털 컨테이너가 교체되지 않는다. 여기서 다시
  // key 를 주면 공유 ShaderMaterial 만 재생성돼 손해다.
  const outlineTarget = selectedMeshTarget ?? clone;
  const outlineObjects = useMemo(() => [outlineTarget], [outlineTarget]);

  // 모델 전체든 자식 노드든 실루엣 테두리로 그린다. 박스는 스텐실이 없어
  // 'box' 를 넘기는 캔버스(지도·모니터링·존 뷰어) 몫이다(prop 주석 참고).
  const useOutline =
    selectionStyle === 'outline' && (isSelected || Boolean(selectedMeshTarget));

  const handleObjectReady = useCallback(
    (readyId: string, object: Object3D | null) => {
      onObjectReady?.(readyId, object);
    },
    [onObjectReady],
  );

  return (
    <ModelMesh
      id={id}
      url={url}
      opacity={opacity}
      alarmSeverity={alarmHighlightMesh ? alarmSeverity : null}
      seaSubmersion={seaSubmersion}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      position={position}
      rotation={rotation}
      scale={scale}
      meshOverrides={meshOverrides}
      enableRaycastBvh={enableRaycastBvh}
      prepareOutline={prepareOutline}
      clonedModel={clonedModel}
      onSelect={onSelect}
      onDoubleSelect={onDoubleSelect}
      onObjectReady={handleObjectReady}
      onHoverStart={onHoverStart}
      onHoverMove={onHoverMove}
      onHoverEnd={onHoverEnd}
    >
      {useOutline ? (
        <ObjectSilhouetteOutline
          objects={outlineObjects}
          color={SELECTION_LINE_COLOR}
        />
      ) : (
        <ModelSelectionBox
          clone={clone}
          isSelected={isSelected || Boolean(selectedMeshTarget)}
          target={selectedMeshTarget}
        />
      )}
      {showLabel ? (
        <ModelLabel
          id={id}
          equipName={equipName}
          localAnchor={labelLocalAnchor}
          alarmSeverity={alarmSeverity}
          dimmed={labelDimmed}
          onSelect={onSelect}
          onHoverStart={onHoverStart}
          onHoverMove={onHoverMove}
          onHoverEnd={onHoverEnd}
        />
      ) : null}
    </ModelMesh>
  );
});
