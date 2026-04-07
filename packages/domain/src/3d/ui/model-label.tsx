import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 이 거리(world units, 카메라 ↔ 라벨 위치)를 초과하면 라벨 DOM을 숨긴다.
 * drei <Html>은 매 프레임 화면 좌표 project + transform 계산을 수행하므로,
 * 멀리 있어 작아 보이는 라벨까지 그리면 100+ 모델 씬에서 hot path가 된다.
 * 알람이 활성화된 라벨은 멀리서도 보여야 하므로 culling 면제.
 */
const LABEL_VISIBILITY_DISTANCE = 120;

type AlarmHighlightSeverity = 'critical' | 'high' | 'medium' | 'info';

const ALARM_LABEL_CLASS: Record<AlarmHighlightSeverity, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-400 text-black',
  info: 'bg-blue-500 text-white',
};

interface ModelLabelProps {
  id: string;
  equipName?: string;
  position: Vector3Tuple;
  offsetY: number;
  alarmSeverity?: AlarmHighlightSeverity | null;
  onSelect?: (id: string, event?: never) => void;
  onHoverStart?: (id: string, clientX: number, clientY: number) => void;
  onHoverMove?: (id: string, clientX: number, clientY: number) => void;
  onHoverEnd?: (id: string) => void;
}

export function ModelLabel({
  id,
  equipName,
  position,
  offsetY,
  alarmSeverity = null,
  onSelect,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}: ModelLabelProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const labelWorldPos = useRef(
    new Vector3(position[0], position[1] + offsetY, position[2]),
  );
  const lastVisibleRef = useRef(true);

  // 카메라 거리에 따라 라벨을 숨긴다. setState 대신 ref 기반 style mutate라
  // React 리렌더가 발생하지 않는다. 알람이 활성화된 라벨은 항상 보여준다.
  useFrame((state) => {
    const div = divRef.current;
    if (!div) return;

    if (alarmSeverity) {
      if (!lastVisibleRef.current) {
        div.style.display = '';
        lastVisibleRef.current = true;
      }
      return;
    }

    labelWorldPos.current.set(position[0], position[1] + offsetY, position[2]);
    const dist = state.camera.position.distanceTo(labelWorldPos.current);
    const visible = dist <= LABEL_VISIBILITY_DISTANCE;
    if (visible !== lastVisibleRef.current) {
      div.style.display = visible ? '' : 'none';
      lastVisibleRef.current = visible;
    }
  });

  if (!equipName) {
    return null;
  }

  return (
    <Html
      center
      zIndexRange={[5, 0]}
      position={[position[0], position[1] + offsetY, position[2]]}
    >
      <div
        ref={divRef}
        className={`cursor-pointer rounded px-1.5 py-0.5 font-mono text-xs font-bold whitespace-nowrap drop-shadow-lg ${alarmSeverity ? ALARM_LABEL_CLASS[alarmSeverity] : 'bg-black/80 text-white'}`}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onPointerEnter={(event) => {
          event.stopPropagation();
          onHoverStart?.(id, event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          onHoverMove?.(id, event.clientX, event.clientY);
        }}
        onPointerLeave={(event) => {
          event.stopPropagation();
          onHoverEnd?.(id);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(id);
        }}
      >
        {equipName}
      </div>
    </Html>
  );
}

export { type AlarmHighlightSeverity };
