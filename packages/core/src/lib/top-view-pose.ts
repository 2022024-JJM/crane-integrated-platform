import type { Vector3Tuple } from '../types/math';

/**
 * 지도 bounds 탑뷰 fit 여백 — computeTopViewPose 가 쓴다. 지금 이 fit 은
 * 카메라 최대 궤도 반경(features camera-limits.ts maxDistanceForBounds)의
 * 기준이고, 탑뷰 버튼은 지금 보는 화면 위로 올라가는 computeTopViewEntryPose 다.
 */
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
 * 만 저장하는 포즈(저장한 뷰·북마크)가 up 을 되살릴 수 없어 복원 시
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
 * 탑뷰(정규 tilt 포즈)의 극각 — OrbitControls 가 탑뷰 중 기울이기를 막을 때
 * `minPolarAngle`·`maxPolarAngle` 양쪽에 두는 값. 진입 포즈의 옆 오프셋이
 * 거리×TOP_VIEW_TILT 라 극각은 정확히 atan(TOP_VIEW_TILT) 다.
 */
export const TOP_VIEW_POLAR_ANGLE = Math.atan(TOP_VIEW_TILT);

/**
 * 직교 탑뷰 카메라가 `userData` 에 남기는 원근 fov 의 키. 직교 카메라는
 * "같은 구도의 원근 카메라가 있을 높이" 에 서고 프러스텀 반높이를
 * 거리×tan(fov/2) 로 잡으므로, 거리·fov 로 판단하는 코드(카메라 제한·지형
 * LOD·실루엣 두께·에디터 F 포커스)는 resolveCameraFov 로 이 값을 읽는다.
 */
export const PERSPECTIVE_FOV_USER_DATA_KEY = 'perspectiveFov';

/**
 * three 카메라가 구조적으로 만족하는 최소 형태 — core 는 three 를 끌어오지
 * 않는다. 원근은 `fov`·`aspect`, 직교는 프러스텀 네 변과 `userData` 의 원근
 * fov 를 본다.
 */
export interface CameraLike {
  isPerspectiveCamera?: boolean;
  isOrthographicCamera?: boolean;
  fov?: number;
  aspect?: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  userData?: Record<string, unknown>;
}

/**
 * 카메라의 세로 fov(도). 원근은 자기 fov, 직교 탑뷰 카메라는 userData 에
 * 남긴 원근 fov. 둘 다 아니면(미니맵 캡처 카메라 등) null — 호출자가 폴백을
 * 정한다.
 */
export function resolveCameraFov(camera: CameraLike): number | null {
  if (camera.isPerspectiveCamera && typeof camera.fov === 'number') {
    return Number.isFinite(camera.fov) ? camera.fov : null;
  }
  const stored = camera.userData?.[PERSPECTIVE_FOV_USER_DATA_KEY];
  return typeof stored === 'number' && Number.isFinite(stored) ? stored : null;
}

/** 카메라 종횡비(가로/세로). 직교는 프러스텀 변 길이의 비. 모르면 null. */
export function resolveCameraAspect(camera: CameraLike): number | null {
  if (camera.isPerspectiveCamera && typeof camera.aspect === 'number') {
    return Number.isFinite(camera.aspect) && camera.aspect > 0
      ? camera.aspect
      : null;
  }
  if (
    typeof camera.left === 'number' &&
    typeof camera.right === 'number' &&
    typeof camera.top === 'number' &&
    typeof camera.bottom === 'number'
  ) {
    const width = camera.right - camera.left;
    const height = camera.top - camera.bottom;
    const aspect = width / height;
    return Number.isFinite(aspect) && aspect > 0 ? aspect : null;
  }
  return null;
}

/**
 * 직교 탑뷰 프러스텀 반높이 — 거리 `distance` 에 있는 원근 카메라(세로 fov)
 * 가 타깃 평면에서 보는 반높이와 같다. 거리·fov 가 유효하지 않으면 0.
 */
export function orthoHalfHeightForDistance(
  distance: number,
  fovDeg: number,
): number {
  if (!(distance > 0) || !(fovDeg > 0) || !(fovDeg < 180)) return 0;
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360);
  return Number.isFinite(tanHalf) && tanHalf > 0 ? distance * tanHalf : 0;
}

/** three OrthographicCamera 가 구조적으로 만족하는 프러스텀 쓰기 대상. */
export interface OrthoFrustumLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
  updateProjectionMatrix: () => void;
}

/**
 * 직교 프러스텀을 반높이·종횡비로 쓴다(zoom 은 1 로 두는 규약 — 세로 fov 가
 * 고정인 원근과 같이 리사이즈로 가로 범위만 바뀐다). 값이 같으면 손대지
 * 않는다.
 */
export function setOrthoFrustum(
  camera: OrthoFrustumLike,
  halfHeight: number,
  aspect: number,
): void {
  if (!(halfHeight > 0)) return;
  const halfWidth = halfHeight * safeAspect(aspect);
  if (
    camera.top === halfHeight &&
    camera.bottom === -halfHeight &&
    camera.right === halfWidth &&
    camera.left === -halfWidth
  ) {
    return;
  }
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.right = halfWidth;
  camera.left = -halfWidth;
  camera.updateProjectionMatrix();
}

/**
 * 포즈의 수평 시선 방향(XZ 단위 벡터, 카메라 → 타깃). 정수직(옆 오프셋이
 * 노이즈 수준 — ensureTopViewTilt 와 같은 tilt/2 판정) 이거나 거리 0·NaN
 * 이면 null. 정규 tilt 포즈는 옆 오프셋이 tilt 그대로라 방향이 나온다 —
 * 탑뷰 진입 때 보던 방향이 복귀까지 유지되는 근거다.
 */
export function headingOfPose(
  position: Vector3Tuple,
  target: Vector3Tuple,
): [number, number] | null {
  const dx = target[0] - position[0];
  const dy = target[1] - position[1];
  const dz = target[2] - position[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!Number.isFinite(distance) || distance === 0) return null;
  const lateral = Math.sqrt(dx * dx + dz * dz);
  if (lateral < (distance * TOP_VIEW_TILT) / 2) return null;
  return [dx / lateral, dz / lateral];
}

/** 탑뷰 기본 방위 — 화면 위가 -Z(북쪽). 보던 방향을 알 수 없을 때. */
const DEFAULT_TOP_VIEW_HEADING: [number, number] = [0, -1];

/**
 * 지금 보는 화면 위에서 내려다보는 탑뷰 진입 포즈 — 현재 카메라-타깃 거리를
 * 유지한 채 타깃 바로 위로 올리고, 보던 수평 방향이 화면 위가 되도록 시선의
 * 반대쪽으로 거리×TOP_VIEW_TILT 만큼 기울인다. 이미 정수직이면 -Z 기준.
 * 거리 0 이면 타깃 그 자리(호출 측이 처리).
 */
export function computeTopViewEntryPose(
  position: Vector3Tuple,
  target: Vector3Tuple,
): CameraPose {
  const dx = position[0] - target[0];
  const dy = position[1] - target[1];
  const dz = position[2] - target[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const heading = headingOfPose(position, target) ?? DEFAULT_TOP_VIEW_HEADING;
  // 오프셋 길이가 정확히 distance 가 되게 수직 성분을 나눈다 — 복귀 포즈가
  // 현재 거리로 스케일하므로 진입·복귀 왕복에서 거리가 변하지 않는다.
  const vertical = distance / Math.sqrt(1 + TOP_VIEW_TILT * TOP_VIEW_TILT);
  const tilt = vertical * TOP_VIEW_TILT;
  return {
    position: [
      target[0] - heading[0] * tilt,
      target[1] + vertical,
      target[2] - heading[1] * tilt,
    ],
    target: [target[0], target[1], target[2]],
  };
}

/**
 * 탑뷰에서 원근으로 돌아갈 포즈 — "지금 보는 곳 기준". 진입 때 저장한 원근
 * 오프셋(카메라−타깃)을 탑뷰에서 돌린 방위만큼 회전하고 현재 거리로 스케일해
 * 현재 타깃에 붙인다. 기울기는 진입 때 그대로, 중심·거리·방위는 탑뷰에서
 * 팬·줌·회전한 결과를 따른다.
 *
 * 저장 포즈의 거리가 0·NaN 이면 스케일할 수 없으니 현재 포즈 그대로. 어느
 * 한쪽의 방위를 알 수 없으면(정확히 정수직) 회전 없이 스케일만 한다.
 */
export function computeTopViewExitPose(
  saved: CameraPose,
  current: CameraPose,
): CameraPose {
  const ox = saved.position[0] - saved.target[0];
  const oy = saved.position[1] - saved.target[1];
  const oz = saved.position[2] - saved.target[2];
  const savedDistance = Math.sqrt(ox * ox + oy * oy + oz * oz);
  if (!Number.isFinite(savedDistance) || savedDistance === 0) {
    return {
      position: [...current.position],
      target: [...current.target],
    };
  }

  const cx = current.position[0] - current.target[0];
  const cy = current.position[1] - current.target[1];
  const cz = current.position[2] - current.target[2];
  const currentDistance = Math.sqrt(cx * cx + cy * cy + cz * cz);
  const scale =
    Number.isFinite(currentDistance) && currentDistance > 0
      ? currentDistance / savedDistance
      : 1;

  const from = headingOfPose(saved.position, saved.target);
  const to = headingOfPose(current.position, current.target);
  let cos = 1;
  let sin = 0;
  if (from && to) {
    cos = from[0] * to[0] + from[1] * to[1];
    sin = from[0] * to[1] - from[1] * to[0];
  }
  // XZ 평면 회전(from → to) 뒤 스케일.
  const rx = (ox * cos - oz * sin) * scale;
  const rz = (ox * sin + oz * cos) * scale;
  const ry = oy * scale;
  const [tx, ty, tz] = current.target;
  return {
    position: [tx + rx, ty + ry, tz + rz],
    target: [tx, ty, tz],
  };
}

/**
 * 카메라·타깃을 점 `point` 기준으로 `scale` 배 — 탑뷰의 커서 기준 줌(직교
 * 프러스텀을 같은 배율로 키우면 그 점이 화면에서 움직이지 않는다)과 원근
 * 줌 버튼(타깃 기준, 거리만 바뀐다)이 같은 식을 쓴다. 배율이 유한한 양수가
 * 아니면 입력 참조 그대로.
 */
export function scalePoseAboutPoint(
  pose: CameraPose,
  point: Vector3Tuple,
  scale: number,
): CameraPose {
  if (!Number.isFinite(scale) || scale <= 0) return pose;
  const [px, py, pz] = point;
  return {
    position: [
      px + (pose.position[0] - px) * scale,
      py + (pose.position[1] - py) * scale,
      pz + (pose.position[2] - pz) * scale,
    ],
    target: [
      px + (pose.target[0] - px) * scale,
      py + (pose.target[1] - py) * scale,
      pz + (pose.target[2] - pz) * scale,
    ],
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
 * 카메라 명령(moveTo/reset/포즈 적용)의 방어선이다. 타깃 정확히 위인
 * 저장값과, up 을 바꾸던 시절 저장된 정수직 북마크가 들어와도 lookAt 이
 * 퇴화하지 않게 한다.
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
 * 방위각(도, −Z 기준 시계 방향 — 나침반·태양 방향과 같은 규약)의 XZ 단위
 * 방향. 비유한수는 −Z(북).
 */
export function headingForAzimuth(azimuthDeg: number): [number, number] {
  if (!Number.isFinite(azimuthDeg)) return [0, -1];
  const a = (azimuthDeg * Math.PI) / 180;
  return [Math.sin(a), -Math.cos(a)];
}

/**
 * 타깃을 축으로 카메라를 돌려 시선의 XZ 방향을 `heading` 에 맞춘 포즈 —
 * 거리·높이·타깃은 그대로다. 탑뷰 포즈는 미세 tilt 의 방향이 곧 화면 위
 * 방향이라 같은 식으로 평면도의 "북쪽 위" 가 된다. 수평 거리가 0(정수직)
 * 이거나 heading 이 퇴화하거나 입력이 비유한수면 원본을 그대로 돌려준다.
 */
export function rotatePoseToHeading(
  position: Vector3Tuple,
  target: Vector3Tuple,
  heading: readonly [number, number],
): CameraPose {
  const same: CameraPose = {
    position: [position[0], position[1], position[2]],
    target: [target[0], target[1], target[2]],
  };
  const values = [...position, ...target, ...heading];
  if (values.some((v) => !Number.isFinite(v))) return same;
  const dx = position[0] - target[0];
  const dz = position[2] - target[2];
  const lateral = Math.sqrt(dx * dx + dz * dz);
  const length = Math.hypot(heading[0], heading[1]);
  if (lateral === 0 || length === 0) return same;
  // 시선 XZ = target − position 이 heading 을 향하려면 position 은 heading 의
  // 반대쪽에 선다.
  const hx = heading[0] / length;
  const hz = heading[1] / length;
  return {
    position: [target[0] - hx * lateral, position[1], target[2] - hz * lateral],
    target: same.target,
  };
}
