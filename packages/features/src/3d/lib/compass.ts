/**
 * 나침반(방위 표시) 기하 — 카메라 자세 + 씬 진북 → 화면에서 북쪽이 놓이는
 * 각도와 지면 원의 세로 비율, 그리고 SVG 에 쓸 좌표. 그리기는
 * ui/scene-compass.tsx 가 DOM 에 직접 쓴다.
 *
 * 나침반은 지면에 놓인 원을 카메라가 보는 모습이다(ACMS 매뉴얼 그림):
 * 탑뷰에선 원, 비스듬히 내려다보면 세로로 납작한 타원이고 바늘도 같이
 * 눕는다. 글자는 타원 위 자리만 따라가고 서 있다(가독성).
 *
 * 좌표는 SVG 화면 좌표(px, 원점 = 나침반 중심, y 아래로 +)다. 각도는
 * 화면 위쪽에서 시계 방향.
 */
import { normalizeDegrees } from '@crane/domain/3d';

export interface CompassVec3 {
  x: number;
  y: number;
  z: number;
}

export interface CompassView {
  /** 화면 위쪽에서 시계 방향으로 잰 북쪽 각도(도, [0,360)). */
  northDeg: number;
  /** 지면 원의 세로/가로 비율 [0,1] — 탑뷰 1, 수평 시선 0. */
  tilt: number;
}

/** SVG 한 변(px). 글자까지 들어가는 크기 — 탑뷰에서 가장 크다. */
export const COMPASS_SIZE_PX = 72;
export const COMPASS_VIEW_BOX = `${-COMPASS_SIZE_PX / 2} ${-COMPASS_SIZE_PX / 2} ${COMPASS_SIZE_PX} ${COMPASS_SIZE_PX}`;
export const COMPASS_RING_RADIUS_PX = 20;
/** 원 위 자리에서 바깥쪽으로 글자를 띄우는 거리(화면 px). */
export const COMPASS_LABEL_OFFSET_PX = 9;
export const COMPASS_NEEDLE_LENGTH_PX = 16;
export const COMPASS_NEEDLE_HALF_WIDTH_PX = 4;

/** 바늘 두 쪽(지면 평면 좌표, 북 = −y). 평면 행렬이 돌리고 눕힌다. */
export const COMPASS_NEEDLE_NORTH_POINTS = `0,${-COMPASS_NEEDLE_LENGTH_PX} ${COMPASS_NEEDLE_HALF_WIDTH_PX},0 ${-COMPASS_NEEDLE_HALF_WIDTH_PX},0`;
export const COMPASS_NEEDLE_SOUTH_POINTS = `0,${COMPASS_NEEDLE_LENGTH_PX} ${COMPASS_NEEDLE_HALF_WIDTH_PX},0 ${-COMPASS_NEEDLE_HALF_WIDTH_PX},0`;

/** 네 방위 글자와 지리 방위(도). 기호라 번역하지 않는다(ACMS 와 같은 글자). */
export const COMPASS_POINTS = [
  { label: 'N', bearing: 0 },
  { label: 'E', bearing: 90 },
  { label: 'S', bearing: 180 },
  { label: 'W', bearing: 270 },
] as const;

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function isFiniteVec3(v: CompassVec3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/**
 * 카메라 월드 전방·위 벡터(단위) + 씬 진북(월드 방위, 도) → 나침반 자세.
 *
 * 화면 위쪽이 지면에서 가리키는 방향은 전방과 위 벡터의 XZ 성분 합이다 —
 * 카메라 up 이 +Y 라 roll 이 없어 둘의 XZ 는 같은 쪽을 향하고, 내려다볼수록
 * 전방 XZ 가 줄어드는 만큼 위 XZ 가 늘어 정수직 탑뷰에서도 방향이 남는다
 * (카메라 제한이 수평 이상 올려다보지 못하게 막는다). 입력이 유한수가
 * 아니거나 방향이 퇴화하면 null — 호출자는 직전 표시를 유지한다.
 */
export function resolveCompassView(
  forward: CompassVec3,
  up: CompassVec3,
  trueNorthDeg: number,
): CompassView | null {
  if (!isFiniteVec3(forward) || !isFiniteVec3(up)) return null;
  if (!Number.isFinite(trueNorthDeg)) return null;
  const sx = forward.x + up.x;
  const sz = forward.z + up.z;
  if (Math.hypot(sx, sz) < 1e-9) return null;
  // 화면 위쪽의 월드 방위(−Z 기준 시계 방향) — sun-direction.ts 와 같은 규약.
  const screenUpAzimuth = Math.atan2(sx, -sz) * RAD2DEG;
  return {
    northDeg: normalizeDegrees(trueNorthDeg - screenUpAzimuth),
    tilt: Math.min(1, Math.max(0, -forward.y)),
  };
}

/**
 * 지면 평면 → 화면 행렬 [a, b, c, d] (SVG `matrix(a b c d 0 0)`). 북쪽
 * 각도만큼 시계 방향으로 돌린 뒤 세로를 tilt 배로 누른다.
 */
export function compassPlaneMatrix(
  view: CompassView,
): [number, number, number, number] {
  const theta = view.northDeg * DEG2RAD;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return [cos, view.tilt * sin, -sin, view.tilt * cos];
}

/**
 * 방위 글자의 화면 위치(글자 중심). 타원 위 자리에서 중심 반대쪽으로
 * COMPASS_LABEL_OFFSET_PX 만큼 띄운다 — 타원이 납작해져도 글자가 원 선과
 * 겹치지 않는다. tilt 0 의 위·아래 자리(중심과 겹침)는 수직으로 띄운다.
 */
export function compassLabelPosition(
  view: CompassView,
  bearingDeg: number,
): { x: number; y: number } {
  const a = (view.northDeg + bearingDeg) * DEG2RAD;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const px = sin * COMPASS_RING_RADIUS_PX;
  const py = -cos * view.tilt * COMPASS_RING_RADIUS_PX;
  let dx = sin;
  let dy = -cos * view.tilt;
  let len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    dx = sin;
    dy = -cos;
    len = 1;
  }
  return {
    x: px + (dx / len) * COMPASS_LABEL_OFFSET_PX,
    y: py + (dy / len) * COMPASS_LABEL_OFFSET_PX,
  };
}
