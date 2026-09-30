import type { SavedLightingInfo } from '@crane/domain/3d';

/**
 * Canvas `shadows` prop 판정 — 세 화면(에디터·모니터링·리플레이)이 같은
 * 기준을 쓰도록 여기서 한 번만 정의한다. 조명 컴포넌트(SceneLighting,
 * scene-render-preset.tsx)의 castShadow도 같은 판정을 쓴다.
 *
 * ui가 아닌 lib에 있는 이유: scene-render-preset.tsx는 컴포넌트 파일이라
 * 함수 export가 react-refresh(HMR) 규칙에 걸린다.
 */
export function isSceneShadowEnabled(
  lighting: SavedLightingInfo | null | undefined,
): boolean {
  return lighting?.shadows === true;
}

/**
 * Canvas `shadows` prop 값. 켤 때는 'percentage'(PCFShadowMap) — 세 화면이
 * 같은 값을 쓰도록 여기서 한 번만 정의한다.
 *
 * 'soft'·true(PCFSoftShadowMap)를 쓰지 않는다. three r183 은 PCFSoft 를
 * 폐기해 첫 shadow pass 에서 PCF 로 바꾸는데, R3F 는 Canvas 가 재렌더될
 * 때마다 타입을 PCFSoft 로 되돌린다. 그 사이(shadow pass 전)에 컴파일된
 * 셰이더는 PCFSoft 의 define 이 없어 BASIC 변형(`sampler2D`)이 되고, 비교
 * 모드 깊이 텍스처를 그 샘플러로 읽는 드로우를 WebGL 이 버린다 — 그림자
 * 패스를 막고 첫 프레임에 찍는 미니맵 캡처에서 그림자 받는 지도·모델이
 * 통째로 빠졌다. 화면 결과는 어차피 PCF 라 룩은 같다.
 */
export function sceneCanvasShadows(
  lighting: SavedLightingInfo | null | undefined,
): 'percentage' | false {
  return isSceneShadowEnabled(lighting) ? 'percentage' : false;
}

/**
 * 시점 추종 shadow frustum 의 초점 — 시선과 지면(y=0)의 교점과 그 시거리.
 * 수평·상향 시선이면 카메라 바로 아래(시거리는 높이 + 여유). SceneLighting 이
 * 매 프레임 기본 카메라로 부르고, 분할 화면은 타일 구도마다 부른 뒤
 * `unionShadowFocus` 로 합친다.
 */
export interface ShadowFocus {
  x: number;
  z: number;
  /** 카메라에서 초점까지의 거리(m) — frustum 반경의 근거. */
  viewDist: number;
}

const HORIZONTAL_VIEW_DIST_MARGIN = 50;

export function resolveShadowFocus(
  position: readonly [number, number, number],
  direction: readonly [number, number, number],
): ShadowFocus {
  let focusX = position[0];
  let focusZ = position[2];
  let viewDist = Math.abs(position[1]) + HORIZONTAL_VIEW_DIST_MARGIN;
  if (direction[1] < -1e-4) {
    const t = -position[1] / direction[1];
    if (t > 0 && Number.isFinite(t)) {
      focusX = position[0] + direction[0] * t;
      focusZ = position[2] + direction[2] * t;
      viewDist = t;
    }
  }
  return { x: focusX, z: focusZ, viewDist };
}

/** position → target 방향(정규화)으로 초점을 구한다. 거리 0 이면 아래를 본다. */
export function resolveShadowFocusForPose(
  position: readonly [number, number, number],
  target: readonly [number, number, number],
): ShadowFocus {
  const dx = target[0] - position[0];
  const dy = target[1] - position[1];
  const dz = target[2] - position[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!Number.isFinite(length) || length === 0) {
    return resolveShadowFocus(position, [0, -1, 0]);
  }
  return resolveShadowFocus(position, [dx / length, dy / length, dz / length]);
}

/**
 * 여러 초점을 하나로 — 초점들의 바운딩 박스 중심을 초점으로, 중심에서 가장
 * 먼 초점까지의 거리에 그 초점의 시거리를 더한 값을 시거리로 둔다. 반경이
 * 시거리 비례라 모든 타일의 시야가 한 frustum 에 든다. 빈 목록은 null.
 */
export function unionShadowFocus(
  focuses: readonly ShadowFocus[],
): ShadowFocus | null {
  if (focuses.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const focus of focuses) {
    minX = Math.min(minX, focus.x);
    maxX = Math.max(maxX, focus.x);
    minZ = Math.min(minZ, focus.z);
    maxZ = Math.max(maxZ, focus.z);
  }
  const x = (minX + maxX) / 2;
  const z = (minZ + maxZ) / 2;
  let viewDist = 0;
  for (const focus of focuses) {
    const reach = Math.hypot(focus.x - x, focus.z - z) + focus.viewDist;
    if (reach > viewDist) viewDist = reach;
  }
  return { x, z, viewDist };
}
