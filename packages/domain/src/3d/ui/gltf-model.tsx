import { memo, useCallback, useMemo } from 'react';
import { Object3D } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Vector3Tuple } from '@crane/core/types/math';
import type {
  EquipmentLabelState,
  EquipmentOutlineState,
} from '@crane/core/types/status';
import {
  ModelMesh,
  useClonedModel,
  useModelLabelLocalAnchor,
} from './model-mesh';
import type { ModelShading } from '../lib/model-shading';
import type { PlanViewKind } from '../lib/plan-view-patch';
import {
  ModelLabel,
  type AlarmHighlightSeverity,
  type ModelLabelTitles,
} from './model-label';
import { PerViewport } from './scene-viewports';
import { ModelSelectionBox } from './model-selection-box';
import { ObjectSilhouetteOutline } from './object-silhouette-outline';
import { ObjectHiddenLine } from './object-hidden-line';
import type {
  ModelLabelReading,
  ModelLabelValueReader,
} from '../lib/label-reading';
import {
  NODE_PREVIEW_OUTLINE_COLOR,
  SELECTION_LINE_COLOR,
} from '../lib/selection-style';
import {
  PLAN_VIEW_OUTLINE_COLOR,
  PLAN_VIEW_OUTLINE_OPACITY,
  PLAN_VIEW_OUTLINE_PX,
  PLAN_VIEW_OUTLINE_RENDER_ORDER,
  STATUS_OUTLINE_COLORS,
  STATUS_OUTLINE_PX,
  isStatusOutlineVisible,
  statusOutlineRenderOrder,
} from '../lib/status-outline-style';
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
  alarmSeverity?: AlarmHighlightSeverity | null;
  alarmHighlightMesh?: boolean;
  /** 라벨의 표시 상태 — 색·아이콘(model-label.tsx). 모니터링 뷰가 판정해 넘긴다. */
  labelState?: EquipmentLabelState;
  /** 라벨 상태·아이콘의 툴팁 문구(번역된 값). */
  labelTitles?: ModelLabelTitles;
  /**
   * 장비 상태 외곽선(통신불량·Slowdown·Endstop) — 모델 전체를 두른다. 색·두께는
   * lib/status-outline-style.ts. 실루엣 테두리라 **캔버스에 스텐실 버퍼가
   * 있어야 한다**(selectionStyle 주석과 같은 전제). 생략·'none' 이면 없다.
   * 모델 전체가 선택돼 있으면 선택 테두리 자리에 이 외곽선을 그린다 — 같은
   * 실루엣을 두 색으로 두르면 굵은 선택 테두리가 상태 색을 덮는다.
   */
  outlineState?: EquipmentOutlineState;
  /**
   * 평면도(직교 탑뷰) 윤곽선 — 모델 전체를 어두운 가는 선으로 두른다
   * (lib/status-outline-style.ts 의 PLAN_VIEW_*). 상태 외곽선이 있으면 그것이
   * 대신한다. 스텐실 전제는 outlineState 와 같다. 기본 false.
   */
  planOutline?: boolean;
  /**
   * 평면도 라벨 — 앵커를 바닥 발자국 중심(선회 축)에 두고 지시선을 내린다
   * (lib/model-label-anchor.ts, model-label.tsx 의 leader). 기본 false.
   */
  planLabel?: boolean;
  /**
   * 평면도 숨은선 — 다른 장비 아래 가려진 부분을 빗금으로 위 장비를 뚫고
   * 보인다(lib/plan-hidden-line.ts). 값은 같은 캔버스의 숨은선 대상 중 이
   * 모델의 자리(0부터)이고 null 이면 그리지 않는다. 스텐실 캔버스 전용.
   */
  planHiddenIndex?: number | null;
  /**
   * 라벨 위에 쌓일 태그 값 목록과 값 읽기 함수(model-label.tsx). 목록은
   * 참조가 안정적이어야 한다 — buildLabelReadings 결과를 memo 해서 넘긴다.
   */
  labelReadings?: readonly ModelLabelReading[];
  readLabelValue?: ModelLabelValueReader;
  /** 수면 아래를 깊이 안개로 흐리게 한다 — 바다 씬의 모델·지도(model-mesh.tsx). */
  seaSubmersion?: boolean;
  /** 평면도 톤 패치 종류(model-mesh.tsx 의 같은 prop). 기본 null. */
  planView?: PlanViewKind | null;
  /**
   * 그림자를 드리울지. 기본 true. 상세는 model-mesh.tsx의 같은 prop 주석 참고.
   */
  castShadow?: boolean;
  /** 그림자를 받을지. 기본 true. 컨텍스트 지형만 false — model-mesh.tsx 주석. */
  receiveShadow?: boolean;
  /**
   * 셰이딩 등급. 기본 'standard'(PBR). 지도는 resolveMapShading 이 정한다
   * (컨텍스트 지형 'lambert', 그 외 지도 'matte') — lib/model-shading.ts.
   */
  shading?: ModelShading;
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
  /**
   * 인스펙터 노드 선택기가 하이라이트한 노드(미리보기). 그 서브트리에 하늘색
   * 실루엣을 두르고 같은 모델의 나머지 메시를 고스트로 그리며, 그동안 선택
   * 테두리·상태 외곽선·평면도 윤곽은 숨긴다. 루트(clone)면 실루엣만 두른다.
   * null 이면 없음.
   */
  previewMeshTarget?: Object3D | null;
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
  planView = null,
  castShadow = true,
  receiveShadow = true,
  shading = 'standard',
  showLabel = true,
  alarmSeverity = null,
  alarmHighlightMesh = false,
  labelState,
  labelTitles,
  outlineState,
  planOutline = false,
  planLabel = false,
  planHiddenIndex = null,
  labelReadings,
  readLabelValue,
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
  previewMeshTarget = null,
  enableRaycastBvh = true,
  onObjectReady,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}: GltfModelProps) {
  // clone은 여기서 1회만 만들고 ModelMesh에 주입한다 — 예전엔 ModelMesh가
  // 따로 clone을 만들어 인스턴스당 clone·computeBoundingSphere가 2회 돌았고,
  // SelectionBox·라벨 앵커가 실제 렌더되는 트리와 다른 clone을 측정했다.
  const clonedModel = useClonedModel(url, undefined, { shading });
  const { clone } = clonedModel;
  const labelLocalAnchor = useModelLabelLocalAnchor(
    clone,
    showLabel,
    planLabel,
  );
  // 선택 표시 대상 — 자식 노드가 선택됐으면 그 노드, 아니면 모델 루트.
  // ObjectSilhouetteOutline 은 내부에서 node.uuid 를 key 로 인스턴스를 새로
  // 만들므로 대상이 바뀌어도 포털 컨테이너가 교체되지 않는다. 여기서 다시
  // key 를 주면 공유 ShaderMaterial 만 재생성돼 손해다.
  const outlineTarget = selectedMeshTarget ?? clone;
  const outlineObjects = useMemo(() => [outlineTarget], [outlineTarget]);
  // 상태 외곽선은 언제나 모델 전체를 두른다.
  const statusOutlineObjects = useMemo(() => [clone], [clone]);
  const previewObjects = useMemo(
    () => (previewMeshTarget ? [previewMeshTarget] : null),
    [previewMeshTarget],
  );
  const statusOutline = isStatusOutlineVisible(outlineState)
    ? outlineState
    : null;

  // 모델 전체든 자식 노드든 실루엣 테두리로 그린다. 박스는 스텐실이 없어
  // 'box' 를 넘기는 캔버스(지도·모니터링·존 뷰어) 몫이다(prop 주석 참고).
  const useOutline =
    selectionStyle === 'outline' && (isSelected || Boolean(selectedMeshTarget));
  // 모델 전체 선택 + 상태 외곽선 — 선택 테두리를 그리지 않고 상태 외곽선이 그
  // 자리를 맡는다. 자식 노드 선택은 대상이 달라 둘 다 그린다.
  const selectionReplaced =
    useOutline && statusOutline !== null && !selectedMeshTarget;

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
      planView={planView}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      shading={shading}
      position={position}
      rotation={rotation}
      scale={scale}
      meshOverrides={meshOverrides}
      enableRaycastBvh={enableRaycastBvh}
      prepareOutline={prepareOutline}
      ghostExcept={previewMeshTarget === clone ? null : previewMeshTarget}
      clonedModel={clonedModel}
      onSelect={onSelect}
      onDoubleSelect={onDoubleSelect}
      onObjectReady={handleObjectReady}
      onHoverStart={onHoverStart}
      onHoverMove={onHoverMove}
      onHoverEnd={onHoverEnd}
    >
      {previewObjects ? (
        // 노드 미리보기 — 실루엣 마스크는 캔버스 전역 합집합이라 모델 전체
        // 외곽선(상태·평면도·선택)이 함께 있으면 노드 테두리가 모델 발자국
        // 안에서 지워진다. 미리보기 동안은 그것들을 숨기고 이것만 그린다.
        <ObjectSilhouetteOutline
          objects={previewObjects}
          color={NODE_PREVIEW_OUTLINE_COLOR}
        />
      ) : statusOutline ? (
        <ObjectSilhouetteOutline
          objects={statusOutlineObjects}
          color={STATUS_OUTLINE_COLORS[statusOutline]}
          thicknessPx={STATUS_OUTLINE_PX}
          renderOrder={statusOutlineRenderOrder(statusOutline)}
        />
      ) : planOutline ? (
        // 아주 가는 반투명 선 하나 — 채움(ObjectPlanFill)은 두지 않는다.
        <ObjectSilhouetteOutline
          objects={statusOutlineObjects}
          color={PLAN_VIEW_OUTLINE_COLOR}
          thicknessPx={PLAN_VIEW_OUTLINE_PX}
          renderOrder={PLAN_VIEW_OUTLINE_RENDER_ORDER}
          opacity={PLAN_VIEW_OUTLINE_OPACITY}
        />
      ) : null}
      {planHiddenIndex !== null ? (
        <ObjectHiddenLine
          objects={statusOutlineObjects}
          index={planHiddenIndex}
        />
      ) : null}
      {useOutline ? (
        selectionReplaced || previewObjects ? null : (
          <ObjectSilhouetteOutline
            objects={outlineObjects}
            color={SELECTION_LINE_COLOR}
          />
        )
      ) : (
        <ModelSelectionBox
          clone={clone}
          isSelected={isSelected || Boolean(selectedMeshTarget)}
          target={selectedMeshTarget}
        />
      )}
      {showLabel ? (
        // 분할 화면이면 타일마다 복제(타일 카메라로 투영, 클릭 없음). 단일
        // 화면이면 그대로 한 번.
        <PerViewport container={clone}>
          {(viewport) => (
            <ModelLabel
              id={id}
              equipName={equipName}
              localAnchor={labelLocalAnchor}
              alarmSeverity={alarmSeverity}
              state={labelState}
              titles={labelTitles}
              readings={labelReadings}
              readValue={readLabelValue}
              interactive={viewport === null}
              leader={planLabel}
              portal={viewport?.portal}
              onSelect={onSelect}
              onHoverStart={onHoverStart}
              onHoverMove={onHoverMove}
              onHoverEnd={onHoverEnd}
            />
          )}
        </PerViewport>
      ) : null}
    </ModelMesh>
  );
});
