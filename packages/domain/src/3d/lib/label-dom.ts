import { Vector3, type Camera } from 'three';
import type {
  EquipmentLabelState,
  EquipmentRuntimeStatus,
} from '@crane/core/types/status';

/**
 * 모델 라벨 DOM 의 순수 계산 — 화면 투영, z-index, 클래스 문자열. ui 의
 * model-label.tsx 는 이것을 프레임마다 부르고 결과만 DOM 에 쓴다.
 *
 * 투영·z-index 는 drei `Html` 의 식 그대로다(`center` 라벨 기준). drei 를 더
 * 쓰지 않는 이유는 model-label.tsx 주석.
 */

const _v = new Vector3();
const _cam = new Vector3();
const _dir = new Vector3();

export interface ScreenPoint {
  x: number;
  y: number;
}

/** 월드 점 → 뷰포트 CSS px(왼쪽 위 원점). 투영 뒤 NDC 를 크기에 맞춘다. */
export function projectToScreen(
  world: Vector3,
  camera: Camera,
  width: number,
  height: number,
  out: ScreenPoint,
): ScreenPoint {
  _v.copy(world).project(camera);
  const halfW = width / 2;
  const halfH = height / 2;
  out.x = _v.x * halfW + halfW;
  out.y = -(_v.y * halfH) + halfH;
  return out;
}

/** 점이 카메라 뒤(시선과 90° 넘게)인지 — 뒤면 투영이 뒤집혀 숨겨야 한다. */
export function isBehindCamera(world: Vector3, camera: Camera): boolean {
  _cam.setFromMatrixPosition(camera.matrixWorld);
  _v.copy(world).sub(_cam);
  camera.getWorldDirection(_dir);
  return _v.angleTo(_dir) > Math.PI / 2;
}

/**
 * 거리 → z-index. `range` 의 [가까움, 멂] 을 카메라 near/far 에 선형으로
 * 놓는다(drei objectZIndex). 라벨은 [5, 0] — 가까운 라벨이 위로.
 */
export function labelZIndex(
  distance: number,
  near: number,
  far: number,
  range: readonly [number, number] = [5, 0],
): number {
  const span = far - near;
  if (!Number.isFinite(span) || span <= 0) return range[0];
  const a = (range[1] - range[0]) / span;
  const b = range[1] - a * far;
  return Math.round(a * distance + b);
}

export type AlarmHighlightSeverity = 'critical' | 'high' | 'medium' | 'info';

const ALARM_LABEL_CLASS: Record<AlarmHighlightSeverity, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-400 text-black',
  info: 'bg-blue-500 text-white',
};

/**
 * 표시 상태 색 — 판정은 features/3d lib/model-label-state.ts. 알람이 없으면
 * 라벨 배경이 곧 상태다(점 없음 — 같은 정보를 두 번 그리지 않는다). 알람이
 * 있으면 배경은 알람색이 차지하므로 상태는 이름 앞 점으로만 남는다. unknown 은
 * 기본 검정 배경.
 *
 * 고장·가동·운전 전원 On·Off 는 ACMS 매뉴얼의 Crane ID Box 그대로다 — 그림에서
 * 뽑은 색(적·녹·황·회), 검은 테두리, 글자는 적색만 흰색이고 나머지는 검정.
 * 가동 색은 features/3d lib/model-runtime-status.ts 의 RUNTIME_STATUS_COLORS 와
 * 함께 바꾼다. 통신두절은 ACMS 에 없는 상태라 기존 색(zinc)을 쓴다. 꺼짐과
 * 통신두절은 둘 다 회색이라 통신두절만 흐리고 이름 앞에 끊김 아이콘을 둔다.
 */
export const LABEL_TONE_DOT_CLASS: Record<
  Exclude<EquipmentRuntimeStatus, 'offline' | 'unknown'>,
  string
> = {
  fault: 'bg-[#ff0000]',
  running: 'bg-[#3ab426]',
  standby: 'bg-[#ffff00]',
  off: 'bg-[#a6a6a6]',
};

const LABEL_TONE_CLASS: Record<EquipmentRuntimeStatus, string> = {
  fault: 'border border-black bg-[#ff0000] text-white',
  running: 'border border-black bg-[#3ab426] text-black',
  standby: 'border border-black bg-[#ffff00] text-black',
  off: 'border border-black bg-[#a6a6a6] text-black',
  offline: 'bg-zinc-700/90 text-zinc-100 ring-1 ring-zinc-400/60',
  unknown: 'bg-black/60 text-white',
};

const LABEL_BOX_BASE =
  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono leading-tight font-semibold whitespace-nowrap drop-shadow';
/** 평상 글자 크기와 관제 모드 강조(글자 ↑, 검은 테두리로 어떤 배경에서도 분리). */
const LABEL_BOX_SIZE = 'text-[11px]';
const LABEL_BOX_EMPHASIS = 'text-[13px] px-2 ring-2 ring-black/80';

/**
 * 상자(이름 칩) 클래스. inert 면 포인터를 받지 않고, dimmed 는 포커스 밖,
 * emphasis 는 관제 모드의 큰 칩.
 */
export function labelBoxClass(
  tone: EquipmentRuntimeStatus,
  alarmSeverity: AlarmHighlightSeverity | null,
  inert: boolean,
  dimmed: boolean,
  emphasis = false,
): string {
  const color = alarmSeverity
    ? ALARM_LABEL_CLASS[alarmSeverity]
    : LABEL_TONE_CLASS[tone];
  const pointer = inert
    ? 'pointer-events-none'
    : 'pointer-events-auto cursor-pointer';
  const opacity = dimmed
    ? 'opacity-30'
    : tone === 'offline' && !alarmSeverity
      ? 'opacity-70'
      : '';
  return [
    LABEL_BOX_BASE,
    emphasis ? LABEL_BOX_EMPHASIS : LABEL_BOX_SIZE,
    color,
    pointer,
    opacity,
  ]
    .filter(Boolean)
    .join(' ');
}

/** 알람 중일 때만 이름 앞에 오는 상태 점의 클래스. 없으면 null. */
export function labelToneDotClass(
  tone: EquipmentRuntimeStatus,
  alarmSeverity: AlarmHighlightSeverity | null,
): string | null {
  if (!alarmSeverity || tone === 'unknown' || tone === 'offline') return null;
  return `inline-block size-2 shrink-0 rounded-full ring-1 ring-black/40 ${LABEL_TONE_DOT_CLASS[tone]}`;
}

export const LABEL_UNKNOWN_STATE: EquipmentLabelState = {
  tone: 'unknown',
  bypass: false,
  freeSwing: false,
};
