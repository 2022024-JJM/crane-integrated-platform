import { useRef } from 'react';
import { Object3D } from 'three';
import type { Vector3Tuple } from '@/shared/types/math';
import { ModelMesh, useClonedModel, useModelLabelOffsetY } from './model-mesh';
import { ModelLabel, type AlarmHighlightSeverity } from './model-label';
import { ModelSelectionBox } from './model-selection-box';

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
  onSelect?: (id: string) => void;
  isSelected?: boolean;
  onObjectReady?: (id: string, object: Object3D | null) => void;
  onHoverStart?: (id: string, clientX: number, clientY: number) => void;
  onHoverMove?: (id: string, clientX: number, clientY: number) => void;
  onHoverEnd?: (id: string) => void;
}

export function GltfModel({
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
  onSelect,
  isSelected = false,
  onObjectReady,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}: GltfModelProps) {
  const modelRef = useRef<Object3D | null>(null);
  const { clone } = useClonedModel(url);
  const offsetY = useModelLabelOffsetY(clone, scale);

  return (
    <>
      <ModelMesh
        id={id}
        url={url}
        opacity={opacity}
        alarmSeverity={alarmHighlightMesh ? alarmSeverity : null}
        position={position}
        rotation={rotation}
        scale={scale}
        onSelect={onSelect}
        onObjectReady={(readyId, object) => {
          modelRef.current = object;
          onObjectReady?.(readyId, object);
        }}
        onHoverStart={onHoverStart}
        onHoverMove={onHoverMove}
        onHoverEnd={onHoverEnd}
      >
        <ModelSelectionBox modelRef={modelRef} isSelected={isSelected} />
      </ModelMesh>

      {showLabel ? (
        <ModelLabel
          id={id}
          equipName={equipName}
          position={position}
          offsetY={offsetY}
          alarmSeverity={alarmSeverity}
          onSelect={onSelect}
          onHoverStart={onHoverStart}
          onHoverMove={onHoverMove}
          onHoverEnd={onHoverEnd}
        />
      ) : null}
    </>
  );
}
