import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3, type Group } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import type { EquipmentRuntimeStatus } from '@crane/core/types/status';

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

/**
 * 운전 상태 표시 — features/3d lib/model-runtime-status.ts 의
 * RUNTIME_STATUS_COLORS(hex) 와 같은 팔레트(emerald·sky·zinc). 알람이 없을 때
 * 라벨 배경을 상태색으로 물들이고 이름 앞에 점을 둔다(점만으로는 먼 거리에서
 * 읽히지 않았다). 알람이 있으면 배경은 알람색, 점만 남는다. unknown 은 기본
 * 검정 배경·점 없음.
 */
const RUNTIME_STATUS_DOT_CLASS: Record<
  Exclude<EquipmentRuntimeStatus, 'unknown'>,
  string
> = {
  running: 'bg-emerald-300',
  idle: 'bg-sky-200',
  offline: 'bg-zinc-300',
};
const RUNTIME_STATUS_LABEL_CLASS: Record<EquipmentRuntimeStatus, string> = {
  running: 'bg-emerald-700/90 text-white ring-1 ring-emerald-300/60',
  idle: 'bg-sky-800/90 text-white ring-1 ring-sky-300/50',
  offline: 'bg-zinc-700/90 text-zinc-100 ring-1 ring-zinc-400/60',
  unknown: 'bg-black/60 text-white',
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
  /**
   * 운전 상태(태그 활동 기반, features 가 판정해 넘긴다). 이름 앞 작은 점으로
   * 표시하고 offline 은 라벨을 살짝 흐리게 — 알람 배경색과 겹쳐도 점은
   * 남는다. 생략·unknown 이면 점 없음.
   */
  runtimeStatus?: EquipmentRuntimeStatus;
  /**
   * 흐림 표시. 모니터링 포커스 중 포커스 밖 모델의 라벨 — 모델 본체가
   * 투명해지는 것과 맞춰 라벨도 흐리게 하고 포인터 이벤트를 끊는다(클릭·
   * hover 콜백 미부착). 라벨은 DOM 이라 material 투명도의 영향을 받지 않는다.
   */
  dimmed?: boolean;
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
  runtimeStatus = 'unknown',
  dimmed = false,
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
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] leading-tight font-semibold whitespace-nowrap drop-shadow ${alarmSeverity ? ALARM_LABEL_CLASS[alarmSeverity] : RUNTIME_STATUS_LABEL_CLASS[runtimeStatus]} ${dimmed ? 'pointer-events-none opacity-30' : runtimeStatus === 'offline' && !alarmSeverity ? 'cursor-pointer opacity-70' : 'cursor-pointer'}`}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onPointerEnter={
            dimmed
              ? undefined
              : (event) => {
                  event.stopPropagation();
                  onHoverStart?.(id, event.clientX, event.clientY);
                }
          }
          onPointerMove={
            dimmed
              ? undefined
              : (event) => {
                  event.stopPropagation();
                  onHoverMove?.(id, event.clientX, event.clientY);
                }
          }
          onPointerLeave={
            dimmed
              ? undefined
              : (event) => {
                  event.stopPropagation();
                  onHoverEnd?.(id);
                }
          }
          onClick={
            dimmed
              ? undefined
              : (event) => {
                  event.stopPropagation();
                  onSelect?.(id);
                }
          }
        >
          {runtimeStatus !== 'unknown' ? (
            <span
              aria-hidden
              className={`inline-block size-2 shrink-0 rounded-full ring-1 ring-black/40 ${RUNTIME_STATUS_DOT_CLASS[runtimeStatus]}`}
            />
          ) : null}
          {equipName}
        </div>
      </Html>
    </group>
  );
}

export { type AlarmHighlightSeverity };
