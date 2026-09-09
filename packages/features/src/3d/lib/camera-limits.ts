import {
  computeTopViewPose,
  type BoundsLike,
} from '@crane/core/lib/top-view-pose';

/**
 * 궤도 카메라 이동 범위 제한의 순수 계산 — 적용은 ui/scene-camera-limits.tsx.
 *
 * ui 가 아닌 lib 에 있는 이유: 컴포넌트 파일의 함수 export 는 react-refresh
 * 규칙에 걸리고(scene-shadow.ts 선례), 극각·클램프 수식은 경계값 테스트가
 * 본론이라 R3F 없이 돌릴 수 있어야 한다. three 를 끌어오지 않고 core 의
 * BoundsLike(three Box3 가 구조적으로 만족) 를 쓴다.
 */

/**
 * 카메라 y 하한의 지면 위 여유(m). 옛 CameraAboveSea 는 1m(바다 평면 아래로
 * 내려가면 단면 컬링으로 바다 뒷면이 투명해지는 것만 막았다)였는데 지면에
 * 붙어 보이는 시점이 너무 낮아 5m 로 올렸다(2026-09-09).
 */
export const CAMERA_GROUND_CLEARANCE = 5;
/**
 * 극각(수직에서 잰 각) 고정 상한. 바닥 기준 동적 상한(maxPolarAngleForMinY)과
 * 함께 min 으로 건다 — 동적 상한만으로는 바닥 바로 위에서 수평에 가까운
 * 시선이 허용돼 지도 밖 수평선이 그대로 보였다. 75° 면 피벗 60m 에서
 * 카메라 높이 ≥ 15.5m. 크레인 상부를 피벗으로 지상에서 올려다보는 구도는
 * 포기한다(2026-09-09).
 */
export const CAMERA_MAX_POLAR_ANGLE = (75 * Math.PI) / 180;
/**
 * 최대 궤도 반경 = 지도 탑뷰 fit 거리 × 이 배수. 1.0 이라 탑뷰가 곧 가장 먼
 * 시점이다 — 휠로 그보다 멀어지지 않는다. 1.5(지도 밖이 넓게 보임) → 0.75
 * (탑뷰에 지도가 다 안 들어옴) 를 거쳐 탑뷰 높이에 맞췄다(2026-09-09).
 */
export const CAMERA_MAX_DISTANCE_RATIO = 1.0;
/**
 * 최대 궤도 반경의 상한이자 지도가 없을 때의 값. core TOP_VIEW_MAX_DISTANCE
 * 와 같은 값이고 에디터 OrbitControls 의 초기 maxDistance 리터럴도 이 값이다
 * (widgets 는 features 를 import 할 수 있지만 JSX 리터럴로 둔 관례). 뷰어
 * (ThreeSceneViewer, @crane/ui)의 초기값은 3000 으로 남겨 둔다 —
 * SceneCameraLimits 가 없는 작은 뷰어(far 5000)의 안전값이고, 세 화면에선
 * SceneCameraLimits 가 첫 프레임에 덮어쓴다.
 *
 * 3000 → 30000(2026-09-09): 폭 18.9km 주변 지형을 기준 지도로 체크하면
 * 3000 에선 탑뷰에 다 안 들어왔다. 카메라 far 50000·바다 원판 40000 안이다
 * — 30000m 높이 탑뷰에서 원판 가장자리까지가 정확히 50000 이라 그 끝만
 * far 에 닿는데, 파도 페이드가 10000 에서 배경색으로 수렴해 티가 안 난다.
 */
export const CAMERA_MAX_DISTANCE = 30000;

function isEmptyBounds(bounds: BoundsLike): boolean {
  return (
    bounds.min.x > bounds.max.x ||
    bounds.min.y > bounds.max.y ||
    bounds.min.z > bounds.max.z
  );
}

/**
 * 카메라 y ≥ minY 를 만드는 극각(φ) 상한. 카메라 up 이 +Y 이므로
 * `camera.y = target.y + distance·cos φ` 가 타깃이 시선 축 위 어디 있든
 * 성립한다 — 표면 피벗(SceneSurfaceCamera)이 타깃을 옮겨도 현재 φ 가 새
 * 상한에 걸리지 않는다.
 *
 * 풀 수 없는 상황은 제한 없음(π): distance ≤ 0·NaN·∞, 타깃이 반경보다 깊이
 * 지하(cos ≥ 1 — 어떤 φ 로도 y ≥ minY 를 못 만든다. 예전엔 0(정수직)으로
 * 강제해 세게 확대하면 버드아이뷰로 튀었다. 팬 백스톱(lift)에 맡긴다),
 * 타깃이 충분히 높음(cos ≤ −1 — 어떤 φ 도 통과).
 */
export function maxPolarAngleForMinY(
  targetY: number,
  distance: number,
  minY: number,
): number {
  if (!Number.isFinite(distance) || distance <= 0) return Math.PI;
  const cos = (minY - targetY) / distance;
  if (!Number.isFinite(cos) || Math.abs(cos) >= 1) return Math.PI;
  return Math.acos(cos);
}

/**
 * 점 (x, z) 를 bounds 의 XZ 사각형 안으로 넣는 델타. 안이면 {0,0}.
 * 빈 bounds·NaN 입력은 null(이동 없음).
 *
 * 경계는 지도 bounds 그대로다. 한때 비율로 바깥에 여유를 두거나 안쪽을
 * 깎았는데, 지도가 작업 구역보다 훨씬 넓은 씬(philly 조선소 폭 2391m)에서
 * 여백이 배치된 모델을 잘라내거나 반대로 무의미해져 비율을 없앴다.
 */
export function clampToBoundsXZ(
  x: number,
  z: number,
  bounds: BoundsLike,
): { dx: number; dz: number } | null {
  if (isEmptyBounds(bounds)) return null;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return {
    dx: Math.min(Math.max(x, bounds.min.x), bounds.max.x) - x,
    dz: Math.min(Math.max(z, bounds.min.z), bounds.max.z) - z,
  };
}

/**
 * 최대 궤도 반경 — 지도 탑뷰 fit 거리(computeTopViewPose 의 position−target)
 * × CAMERA_MAX_DISTANCE_RATIO, CAMERA_MAX_DISTANCE 이하. 뷰어·에디터의 탑뷰는
 * 이 값(controls.maxDistance)을 상한으로 넘겨 반경 clamp 에 튀지 않게 한다.
 * bounds 가 없거나 비면 상한값.
 */
export function maxDistanceForBounds(
  bounds: BoundsLike | null,
  aspect: number,
  fovDeg: number,
): number {
  if (!bounds) return CAMERA_MAX_DISTANCE;
  const pose = computeTopViewPose(bounds, aspect, fovDeg, {
    maxDistance: CAMERA_MAX_DISTANCE,
  });
  if (!pose) return CAMERA_MAX_DISTANCE;
  const dx = pose.position[0] - pose.target[0];
  const dy = pose.position[1] - pose.target[1];
  const dz = pose.position[2] - pose.target[2];
  const fit = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!Number.isFinite(fit) || fit <= 0) return CAMERA_MAX_DISTANCE;
  return Math.min(fit * CAMERA_MAX_DISTANCE_RATIO, CAMERA_MAX_DISTANCE);
}
