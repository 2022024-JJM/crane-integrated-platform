import type { BoundsLike } from '@crane/core/lib/top-view-pose';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 2D 미니맵의 순수 계산 — 적용은 ui/scene-minimap.tsx(DOM 캔버스)와
 * ui/scene-minimap-capture.tsx(탑뷰 스냅샷)가 한다.
 *
 * ui 가 아닌 lib 에 있는 이유는 camera-limits.ts 와 같다 — 픽셀↔월드 변환과
 * 카메라 발자국 수식은 경계값 테스트가 본론이라 R3F 없이 돌아야 하고, 컴포넌트
 * 파일의 함수 export 는 react-refresh 규칙에 걸린다.
 *
 * 좌표 규약: 미니맵은 월드 XZ 평면의 **탑뷰**다. 이미지 가로(px 오른쪽) = 월드
 * +X, 이미지 세로(px 아래쪽) = 월드 +Z. 스냅샷을 찍는 직교 카메라가
 * `up = (0,0,-1)` 로 아래를 보면 three 의 lookAt 기저가 정확히 이 방향이 된다
 * (x = up × z = (0,0,-1)×(0,1,0) = (1,0,0), y = z × x = (0,0,-1)). 이미지
 * 픽셀과 씬 좌표를 잇는 유일한 수식이 이 파일이므로, 카메라 기저를 바꾸면
 * 여기 변환도 함께 바꿔야 한다.
 */

export interface MinimapFrame {
  /** 이미지 왼쪽 가장자리의 월드 X, 위쪽 가장자리의 월드 Z. */
  minX: number;
  minZ: number;
  /** 이미지가 덮는 월드 폭(X)·깊이(Z), m. */
  worldWidth: number;
  worldDepth: number;
  /** 이미지 픽셀 크기. */
  pxWidth: number;
  pxHeight: number;
}

/**
 * 지도 bounds 주변에 두는 여백 비율 — 경계에 걸친 장비 마커가 가장자리에
 * 붙지 않게 하는 정도면 된다(카메라 이동 제한은 bounds 그대로라 여백 밖으로는
 * 어차피 못 간다).
 */
export const MINIMAP_PADDING_RATIO = 0.03;

/** 한 변의 픽셀 하한 — 이보다 가늘면 마커·발자국이 뭉개져 읽히지 않는다. */
export const MINIMAP_MIN_PX = 96;

function isEmptyBounds(bounds: BoundsLike): boolean {
  return (
    bounds.min.x > bounds.max.x ||
    bounds.min.y > bounds.max.y ||
    bounds.min.z > bounds.max.z
  );
}

/**
 * 월드 XZ bounds → 미니맵 프레임. 긴 변이 `maxPx` 에 맞고 짧은 변은 종횡비를
 * 따르되 MINIMAP_MIN_PX 아래로는 내려가지 않는다(가늘고 긴 안벽 지도에서
 * 세로가 20px 로 짜부라지는 것 방지 — 그 경우 이미지가 세로로 늘어나는 게
 * 아니라 월드 범위가 세로로 더 넓게 잡힌다: 여백이 늘어나는 것이지 왜곡이
 * 아니다).
 *
 * bounds 가 비었거나(three 기본 Box3) 한 축 폭이 0·NaN 이면 null.
 */
export function computeMinimapFrame(
  bounds: BoundsLike,
  maxPx: number,
): MinimapFrame | null {
  if (isEmptyBounds(bounds)) return null;
  if (!Number.isFinite(maxPx) || maxPx < MINIMAP_MIN_PX) return null;
  const width = bounds.max.x - bounds.min.x;
  const depth = bounds.max.z - bounds.min.z;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(depth) ||
    width <= 0 ||
    depth <= 0
  ) {
    return null;
  }

  const padX = width * MINIMAP_PADDING_RATIO;
  const padZ = depth * MINIMAP_PADDING_RATIO;
  let worldWidth = width + padX * 2;
  let worldDepth = depth + padZ * 2;
  let minX = bounds.min.x - padX;
  let minZ = bounds.min.z - padZ;

  // 긴 변을 maxPx 에 맞춘 뒤 짧은 변이 하한에 걸리면 월드 범위를 그 축으로
  // 넓혀 픽셀 비율(m/px)을 양 축 동일하게 유지한다.
  const unitsPerPx = Math.max(worldWidth, worldDepth) / maxPx;
  let pxWidth = Math.round(worldWidth / unitsPerPx);
  let pxHeight = Math.round(worldDepth / unitsPerPx);
  if (pxWidth < MINIMAP_MIN_PX) {
    pxWidth = MINIMAP_MIN_PX;
    const grown = pxWidth * unitsPerPx;
    minX -= (grown - worldWidth) / 2;
    worldWidth = grown;
  }
  if (pxHeight < MINIMAP_MIN_PX) {
    pxHeight = MINIMAP_MIN_PX;
    const grown = pxHeight * unitsPerPx;
    minZ -= (grown - worldDepth) / 2;
    worldDepth = grown;
  }

  return { minX, minZ, worldWidth, worldDepth, pxWidth, pxHeight };
}

/** 월드 XZ → 미니맵 픽셀(클램프 없음 — 밖이면 밖으로 나온다). */
export function worldToMinimap(
  frame: MinimapFrame,
  x: number,
  z: number,
): { px: number; py: number } {
  return {
    px: ((x - frame.minX) / frame.worldWidth) * frame.pxWidth,
    py: ((z - frame.minZ) / frame.worldDepth) * frame.pxHeight,
  };
}

/**
 * 미니맵 픽셀 → 월드 XZ. 픽셀은 이미지 안으로 클램프한다 — 드래그가 미니맵
 * 밖으로 나가도(포인터 캡처) 카메라가 지도 밖으로 튀지 않게.
 */
export function minimapToWorld(
  frame: MinimapFrame,
  px: number,
  py: number,
): { x: number; z: number } {
  const cx = Math.min(Math.max(px, 0), frame.pxWidth);
  const cy = Math.min(Math.max(py, 0), frame.pxHeight);
  return {
    x: frame.minX + (cx / frame.pxWidth) * frame.worldWidth,
    z: frame.minZ + (cy / frame.pxHeight) * frame.worldDepth,
  };
}

export interface MinimapPose {
  position: Vector3Tuple;
  target: Vector3Tuple;
}

/**
 * 타깃을 월드 (x, z) 로 옮긴 포즈 — 카메라는 같은 오프셋을 유지해 높이·시선
 * 방향·거리가 그대로다(팬과 같은 결과). 타깃 y 는 유지한다.
 * NaN 입력은 원본 포즈를 그대로 돌려준다(참조 유지).
 */
export function panPoseToPoint(
  pose: MinimapPose,
  x: number,
  z: number,
): MinimapPose {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return pose;
  const dx = x - pose.target[0];
  const dz = z - pose.target[2];
  return {
    position: [pose.position[0] + dx, pose.position[1], pose.position[2] + dz],
    target: [x, pose.target[1], z],
  };
}

/** 세로 fov(도)·종횡비 → 가로 fov(도). */
export function horizontalFovDeg(
  verticalFovDeg: number,
  aspect: number,
): number {
  const half = (verticalFovDeg * Math.PI) / 360;
  return (Math.atan(Math.tan(half) * aspect) * 360) / Math.PI;
}

export interface MinimapFootprint {
  /** 카메라 월드 XZ. */
  x: number;
  z: number;
  /** 카메라→타깃의 XZ 방향(rad). atan2(dz, dx) — +X 가 0, +Z 가 π/2. */
  heading: number;
  /** 가로 fov 의 절반(rad). */
  halfAngle: number;
  /** 카메라→타깃 XZ 거리(m). 정수직 탑뷰면 0 에 가깝다. */
  length: number;
}

/**
 * 카메라 발자국 — 카메라 XZ 에서 타깃 방향으로 가로 fov 만큼 벌어지는 부채꼴.
 * 기울어진 원근 카메라의 지면 절단면(사다리꼴)의 근사이고, 관제 미니맵에서
 * "어디를 보고 있는가"를 읽는 데는 충분하다. 카메라가 타깃 바로 위(탑뷰)면
 * 방향이 정의되지 않아 length 0·heading 0 을 돌려주며, 그리는 쪽은 length
 * 가 짧으면 점만 찍는다.
 */
export function cameraFootprint(
  pose: MinimapPose,
  hFovDeg: number,
): MinimapFootprint {
  const dx = pose.target[0] - pose.position[0];
  const dz = pose.target[2] - pose.position[2];
  const length = Math.hypot(dx, dz);
  return {
    x: pose.position[0],
    z: pose.position[2],
    heading: length > 1e-6 ? Math.atan2(dz, dx) : 0,
    halfAngle: (hFovDeg * Math.PI) / 360,
    length: Number.isFinite(length) ? length : 0,
  };
}

/**
 * 마커 후보 중 픽셀 (px, py) 에서 `radiusPx` 안의 가장 가까운 것의 인덱스.
 * 없으면 -1. 호버 라벨용.
 */
export function nearestMarkerIndex(
  markers: ReadonlyArray<{ px: number; py: number }>,
  px: number,
  py: number,
  radiusPx: number,
): number {
  let best = -1;
  let bestSq = radiusPx * radiusPx;
  for (let i = 0; i < markers.length; i += 1) {
    const m = markers[i];
    const dSq = (m.px - px) ** 2 + (m.py - py) ** 2;
    if (dSq <= bestSq) {
      bestSq = dSq;
      best = i;
    }
  }
  return best;
}

export interface PanelPosition {
  x: number;
  y: number;
}

/**
 * 미니맵 패널 좌상단 위치를 컨테이너(캔버스 영역) 안으로 넣는다 — 패널이
 * 컨테이너보다 크면 좌상단 0 에 붙인다. NaN 좌표는 0 으로 본다.
 * 저장된 위치를 다른 창 크기에서 복원할 때와 드래그 중 매 이동에 쓴다.
 */
export function clampPanelPosition(
  position: PanelPosition,
  panelWidth: number,
  panelHeight: number,
  containerWidth: number,
  containerHeight: number,
): PanelPosition {
  const maxX = Math.max(0, containerWidth - panelWidth);
  const maxY = Math.max(0, containerHeight - panelHeight);
  const x = Number.isFinite(position.x) ? position.x : 0;
  const y = Number.isFinite(position.y) ? position.y : 0;
  return {
    x: Math.min(Math.max(x, 0), maxX),
    y: Math.min(Math.max(y, 0), maxY),
  };
}
