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
const LABEL_VISIBILITY_DISTANCE = 1000;

/**
 * 거리 기반 라벨 축소. 카메라가 REF보다 가까우면 원래 크기(1x),
 * 멀어질수록 REF/dist 비율로 줄어들되 MIN 밑으로는 내려가지 않는다.
 * 순수 원근 스케일(distanceFactor)과 달리 근접 시 라벨이 과도하게
 * 커지지 않고, 원거리에서도 최소 가독 크기를 유지한다.
 * 알람 라벨은 시인성이 우선이라 축소하지 않는다.
 */
const LABEL_SCALE_REF_DISTANCE = 300;
const LABEL_MIN_SCALE = 0.45;

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
  const lastScaleRef = useRef(1);

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
      if (lastScaleRef.current !== 1) {
        div.style.transform = '';
        lastScaleRef.current = 1;
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
    if (!visible) return;

    // drei <Html>은 wrapper에 자체 transform을 걸므로, 스케일은 우리가 소유한
    // 안쪽 div에 적용해 충돌을 피한다. 0.02 단위 스냅으로 매 프레임 style
    // 재작성을 방지.
    const rawScale = Math.min(1, LABEL_SCALE_REF_DISTANCE / dist);
    const scale = Math.max(LABEL_MIN_SCALE, Math.round(rawScale * 50) / 50);
    if (scale !== lastScaleRef.current) {
      div.style.transform = scale === 1 ? '' : `scale(${scale})`;
      lastScaleRef.current = scale;
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
          className={`cursor-pointer rounded px-1 py-px font-mono text-[11px] leading-tight font-semibold whitespace-nowrap drop-shadow ${alarmSeverity ? ALARM_LABEL_CLASS[alarmSeverity] : 'bg-black/60 text-white'}`}
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
