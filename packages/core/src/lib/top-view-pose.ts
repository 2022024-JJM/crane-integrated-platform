import type { Vector3Tuple } from '../types/math';

/** 뷰어(ThreeSceneViewer.moveToTopView)·편집기 공용 탑뷰 fit 여백. */
export const TOP_VIEW_PADDING = 1.08;
/**
 * 탑뷰 거리 상한 — features CAMERA_MAX_DISTANCE(최대 궤도 반경 상한)와 같은
 * 값. 3000 이던 것을 30000 으로 올렸다(2026-09-09) — 폭 18.9km 주변 지형을
 * 카메라 기준 지도로 체크하면 3000 에선 탑뷰에 다 안 들어왔다. 카메라 far
 * (SCENE_CAMERA_CLIP 50000)와 바다 원판 반경(40000) 안이어야 한다.
 */
export const TOP_VIEW_MAX_DISTANCE = 30000;
/**
 * 정수직 회피용 미세 기울기(거리 대비 비율).
 *
 * 카메라 up 은 항상 +Y 로 둔다. 탑뷰를 위해 up 을 (0,0,-1) 로 바꾸면
 * OrbitControls 의 극점이 ±Z 로 틀어져 회전이 어색하고, `{position, target}`
 * 만 저장하는 포즈(포커스 복귀·북마크)가 up 을 되살릴 수 없어 복원 시
 * 화면이 돌아간다. 그렇다고 up=+Y 인 채 타깃 정확히 위에 서면 시선과 up 이
 * 평행해 `lookAt` 이 퇴화하고(roll 이 부동소수 노이즈로 결정) spherical
 * theta 를 잃는다. 대신 카메라를 +Z 쪽으로 아주 조금 기울인다 — 화면 위는
 * -Z(북쪽)가 되고, theta=0 으로 결정론적이며, 저장한 위치·타깃만으로
 * 같은 화면이 복원된다.
 */
export const TOP_VIEW_TILT = 1e-3;

export interface CameraPose {
  position: Vector3Tuple;
  target: Vector3Tuple;
}

/** three `Box3` 가 구조적으로 만족하는 최소 형태. core 는 three 를 끌어오지 않는다. */
export interface BoundsLike {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface TopViewPoseOptions {
  /** 기본 TOP_VIEW_PADDING. */
  padding?: number;
  /** 기본 TOP_VIEW_MAX_DISTANCE. */
  maxDistance?: number;
  /** 기본 0. 편집기 캔버스는 F 포커스와 같은 최소 거리를 넘긴다. */
  minDistance?: number;
}

function safeAspect(aspect: number): number {
  return Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
}

/** three `Box3.isEmpty()` 와 같은 판정 — 어느 축이든 min > max. */
function isEmptyBounds(bounds: BoundsLike): boolean {
  return (
    bounds.min.x > bounds.max.x ||
    bounds.min.y > bounds.max.y ||
    bounds.min.z > bounds.max.z
  );
}

/**
 * 월드 AABB 의 XZ 가 화면에 꽉 차는 탑뷰 포즈. 세로(z)와 가로(x/aspect) 중
 * 더 큰 쪽을 수직 fov 에 맞춘다. 빈 박스는 null.
 */
export function computeTopViewPose(
  bounds: BoundsLike,
  aspect: number,
  fovDeg: number,
  options: TopViewPoseOptions = {},
): CameraPose | null {
  if (isEmptyBounds(bounds)) return null;

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
 * 올린다(tilt 동일 적용).
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

/**
 * 정수직(또는 노이즈 수준으로만 벗어난) 포즈를 TOP_VIEW_TILT 만큼 +Z 로
 * 기울인 정규 포즈로 바꾼다. 그 밖의 포즈는 **입력 참조 그대로** 돌려준다.
 * "노이즈" 판정은 tilt 의 절반 — computeTopViewPose 가 만든 정규 포즈는
 * 옆 오프셋이 tilt 그대로라 손대지 않고(재계산한 거리가 미세하게 달라 같은
 * 값으로 다시 스냅해도 참조가 바뀐다), 부동소수 오차(1e-16·거리)와
 * OrbitControls EPS 클램프(1e-6·거리)는 그 아래라 스냅된다.
 *
 * 카메라 명령(moveTo/reset/탑뷰 프리셋)의 방어선이다. 사이트 프리셋
 * `topViewPosition: [0, 30, 0]` 처럼 타깃 정확히 위인 값과, up 을 바꾸던
 * 시절 저장된 정수직 북마크가 들어와도 lookAt 이 퇴화하지 않게 한다.
 * 거리 0·NaN 은 판단할 수 없으니 손대지 않는다.
 */
export function ensureTopViewTilt(
  position: Vector3Tuple,
  target: Vector3Tuple,
): Vector3Tuple {
  const dx = position[0] - target[0];
  const dy = position[1] - target[1];
  const dz = position[2] - target[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!Number.isFinite(distance) || distance === 0) return position;

  const lateral = Math.sqrt(dx * dx + dz * dz);
  const tilt = distance * TOP_VIEW_TILT;
  if (lateral >= tilt / 2) return position;

  return [target[0], position[1], target[2] + tilt];
}

/**
 * 평면(탑뷰) 판정 — 시선의 -Y 성분이 이 값(cos 30°) 이상이면 "충분히 내려다본다".
 * 뷰어(탑뷰 fov 복원)와 features 의 평면 기호·마커가 같은 문턱을 쓴다.
 */
export const TOP_VIEW_PLAN_MIN_DOWN = 0.866;

export function isPlanDirection(directionY: number): boolean {
  return Number.isFinite(directionY) && directionY <= -TOP_VIEW_PLAN_MIN_DOWN;
}

/**
 * fov 를 바꿀 때 같은 화면 범위를 유지하는 거리 배율 — tan(이전/2)/tan(새/2).
 * 좁은 fov(망원) 탑뷰는 원근 왜곡이 작아 평면도에 가깝고, 그만큼 멀리서
 * 본다. 거리 상한(controls.maxDistance)도 같은 배율로 늘려야 포즈가 잘리지
 * 않는다.
 */
export function fovDistanceScale(fromFovDeg: number, toFovDeg: number): number {
  const a = Math.tan((fromFovDeg * Math.PI) / 360);
  const b = Math.tan((toFovDeg * Math.PI) / 360);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return 1;
  return a / b;
}

/**
 * 지금 보는 자리 위의 탑뷰 — 궤도 타깃을 그대로 중심으로, 지금 타깃까지의
 * 거리(× fov 배율)만큼 위에서 내려다본다. 전체 야드가 아니라 **보던 구역**이
 * 같은 축척으로 평면이 된다. 거리는 [minDistance, maxDistance] 로 자른다.
 * 타깃·거리가 비유한이면 null(호출자가 범위 프레이밍으로 폴백).
 */
export function computeLocalTopViewPose(
  target: Vector3Tuple,
  distance: number,
  options: TopViewPoseOptions = {},
): CameraPose | null {
  const { maxDistance = TOP_VIEW_MAX_DISTANCE, minDistance = 0 } = options;
  if (
    !target.every((v) => Number.isFinite(v)) ||
    !Number.isFinite(distance) ||
    distance <= 0
  ) {
    return null;
  }
  const d = Math.min(Math.max(distance, minDistance), maxDistance);
  return {
    position: [target[0], target[1] + d, target[2] + d * TOP_VIEW_TILT],
    target: [target[0], target[1], target[2]],
  };
}
