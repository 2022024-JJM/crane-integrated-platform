import type { Box3 } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';

/** 뷰어(ThreeSceneViewer.moveToTopView)와 같은 여유 비율. */
export const TOP_VIEW_PADDING = 1.08;
/** 뷰어 탑뷰·편집기 OrbitControls maxDistance 와 같은 상한. */
export const TOP_VIEW_MAX_DISTANCE = 3000;
/**
 * 정수직 회피용 미세 기울기(거리 대비 비율).
 *
 * 뷰어는 탑뷰에서 camera.up 을 (0,0,-1) 로 바꿔 북쪽(-Z)을 화면 위로
 * 맞춘다. 편집기는 탑뷰 직후 바로 가운데 드래그로 궤도 회전을 이어가는데,
 * up 을 바꾸면 OrbitControls 의 극점이 ±Z 로 틀어져 초기 시점을 누르기
 * 전까지 회전이 어색하다. 대신 up 은 +Y 로 두고 카메라를 +Z 쪽으로 아주
 * 조금 기울인다 — OrbitControls 의 spherical 이 퇴화하지 않고(theta=0),
 * 화면 위는 뷰어와 같은 -Z 가 되며, 초기 시점이 up 을 복원할 필요도 없다.
 */
export const TOP_VIEW_TILT = 1e-3;

export interface CameraPose {
  position: Vector3Tuple;
  target: Vector3Tuple;
}

export interface TopViewPoseOptions {
  /** 기본 TOP_VIEW_PADDING. */
  padding?: number;
  /** 기본 TOP_VIEW_MAX_DISTANCE. */
  maxDistance?: number;
  /** 기본 0. 캔버스는 F 포커스와 같은 최소 거리를 넘긴다. */
  minDistance?: number;
}

function safeAspect(aspect: number): number {
  return Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
}

/**
 * 월드 AABB 의 XZ 가 화면에 꽉 차는 탑뷰 포즈. 세로(z)와 가로(x/aspect) 중
 * 더 큰 쪽을 수직 fov 에 맞춘다(뷰어와 같은 식). 빈 박스는 null.
 */
export function computeTopViewPose(
  bounds: Box3,
  aspect: number,
  fovDeg: number,
  options: TopViewPoseOptions = {},
): CameraPose | null {
  if (bounds.isEmpty()) return null;

  const {
    padding = TOP_VIEW_PADDING,
    maxDistance = TOP_VIEW_MAX_DISTANCE,
    minDistance = 0,
  } = options;

  const sizeX = bounds.max.x - bounds.min.x;
  const sizeZ = bounds.max.z - bounds.min.z;
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerY = (bounds.min.y + bounds.max.y) / 2;
  const centerZ = (bounds.min.z + bounds.max.z) / 2;

  const halfHeight = Math.max(sizeZ / 2, sizeX / (2 * safeAspect(aspect)));
  const halfFov = (fovDeg * Math.PI) / 360;
  const raw = (halfHeight / Math.tan(halfFov)) * padding;
  const distance = Math.min(Math.max(raw, minDistance), maxDistance);

  return {
    position: [
      centerX,
      bounds.max.y + distance,
      centerZ + distance * TOP_VIEW_TILT,
    ],
    target: [centerX, centerY, centerZ],
  };
}

/**
 * 바운즈가 없을 때 — 현재 카메라-타깃 거리를 유지한 채 타깃 바로 위로
 * 올린다(뷰어의 topViewPosition 폴백과 같은 규칙, tilt 는 동일하게 적용).
 */
export function computeTopViewFallbackPose(
  position: Vector3Tuple,
  target: Vector3Tuple,
): CameraPose {
  const dx = position[0] - target[0];
  const dy = position[1] - target[1];
  const dz = position[2] - target[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return {
    position: [
      target[0],
      target[1] + distance,
      target[2] + distance * TOP_VIEW_TILT,
    ],
    target: [target[0], target[1], target[2]],
  };
}
