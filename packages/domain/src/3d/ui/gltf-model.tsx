import { memo, useCallback } from 'react';
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
  meshOverrides?: SavedMeshOverride[];
  /**
   * 센서(LIDAR/Camera) raycast의 occluder 후보로 이 모델을 등록할지.
   * 기본 true. 지도(map)처럼 지형 역할이라 센서가 장애물로 감지하면 안 되는
   * 경우 false로 전달.
   */
  isSensorOccluder?: boolean;
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
   * 자식 mesh가 선택된 경우 그 mesh 객체. ModelSelectionBox가 이 mesh의
   * bbox만으로 selection box를 그리도록 한다. null이면 모델 전체 박스.
   */
  selectedMeshTarget?: Object3D | null;
  onObjectReady?: (id: string, object: Object3D | null) => void;
  onHoverStart?: (id: string, clientX: number, clientY: number) => void;
  onHoverMove?: (id: string, clientX: number, clientY: number) => void;
  onHoverEnd?: (id: string) => void;
}

export const GltfModel = memo(function GltfModel({
  id,
  url,
  equipName,
  opacity = 1,
  showLabel = true,
  alarmSeverity = null,
  alarmHighlightMesh = false,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  meshOverrides,
  onSelect,
  onDoubleSelect,
  isSelected = false,
  selectedMeshTarget = null,
  isSensorOccluder = true,
  onObjectReady,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}: GltfModelProps) {
  const { clone } = useClonedModel(url);
  const labelLocalAnchor = useModelLabelLocalAnchor(clone);

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
      position={position}
      rotation={rotation}
      scale={scale}
      meshOverrides={meshOverrides}
      isSensorOccluder={isSensorOccluder}
      onSelect={onSelect}
      onDoubleSelect={onDoubleSelect}
      onObjectReady={handleObjectReady}
      onHoverStart={onHoverStart}
      onHoverMove={onHoverMove}
      onHoverEnd={onHoverEnd}
    >
      <ModelSelectionBox
        clone={clone}
        isSelected={isSelected || Boolean(selectedMeshTarget)}
        target={selectedMeshTarget}
      />
      {showLabel ? (
        <ModelLabel
          id={id}
          equipName={equipName}
          localAnchor={labelLocalAnchor}
          alarmSeverity={alarmSeverity}
          onSelect={onSelect}
          onHoverStart={onHoverStart}
          onHoverMove={onHoverMove}
          onHoverEnd={onHoverEnd}
        />
      ) : null}
    </ModelMesh>
  );
});
