import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3, type Group } from 'three';
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
  /**
   * 부모 객체(primitive=clone)의 local 좌표. ModelMesh가 렌더하는
   * <primitive object={clone}>의 자식으로 마운트되므로 부모 transform
   * (TransformControls가 매 frame mutate하는 transform 포함)을 자동 상속받는다.
   * sceneInfo prop이 아니므로 드래그 중에도 정확히 따라간다.
   */
  localAnchor: Vector3Tuple;
  alarmSeverity?: AlarmHighlightSeverity | null;
  onSelect?: (id: string, event?: never) => void;
  onHoverStart?: (id: string, clientX: number, clientY: number) => void;
  onHoverMove?: (id: string, clientX: number, clientY: number) => void;
  onHoverEnd?: (id: string) => void;
}

export function ModelLabel({
  id,
  equipName,
  localAnchor,
  alarmSeverity = null,
  onSelect,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}: ModelLabelProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<Group>(null);
  const tempWorldPos = useRef(new Vector3());
  const lastVisibleRef = useRef(true);

  // 카메라 거리에 따라 라벨을 숨긴다. setState 대신 ref 기반 style mutate라
  // React 리렌더가 발생하지 않는다. 알람이 활성화된 라벨은 항상 보여준다.
  useFrame((state) => {
    const div = divRef.current;
    const group = groupRef.current;
    if (!div || !group) return;

    if (alarmSeverity) {
      if (!lastVisibleRef.current) {
        div.style.display = '';
        lastVisibleRef.current = true;
      }
      return;
    }

    // group은 primitive(clone)의 자식이므로 부모 transform이 적용된 worldMatrix
    // 를 갖는다. getWorldPosition이 그 결과를 추출.
    group.getWorldPosition(tempWorldPos.current);
    const dist = state.camera.position.distanceTo(tempWorldPos.current);
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
    <group ref={groupRef} position={localAnchor}>
      <Html center zIndexRange={[5, 0]}>
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
    </group>
  );
}

export { type AlarmHighlightSeverity };
