import {
  Color,
  DoubleSide,
  ShaderMaterial,
  Vector2,
  Vector3,
  type IUniform,
} from 'three';

/**
 * 편집기 바닥 격자 셰이더 — 월드 y=0 고정 · 오버레이 · 화면 밀도 LOD.
 *
 * drei `Grid` 를 쓰지 않는 이유: 재질 타입에 opacity/depthTest 가 없어
 * 모델을 뚫고 보이는 오버레이로 만들 수 없다. 또 먼 거리에서
 * 셀 선이 서브픽셀이 되면 fwidth 기반 커버리지가 1 로 수렴해 평면 전체가
 * 회색 안개가 된다.
 *
 * - **월드 정렬**: 프래그먼트가 `modelMatrix * position` 의 월드 XZ 로 선을
 *   계산한다. 메시는 평면이 바닥나지 않게 매 프레임 카메라 XZ 를 따라가지만
 *   선은 월드 정수 좌표에 고정돼 1m 기즈모 스냅(SCENE_TRANSFORM_SNAP)과
 *   일치한다.
 * - **3단계 + 화면 밀도 LOD**: 단계별로 "셀당 픽셀 수" 가 GROUND_GRID_LOD_FADE_PX
 *   아래로 내려가면 그 단계의 선을 지운다. 어느 축이든 촘촘해지면 지우므로
 *   수평선 방향으로 모이는 선(모아레)도 함께 사라진다.
 * - **가장자리 페이드**: 평면이 카메라 XZ 를 중심으로 깔리므로 카메라 XZ
 *   투영점 거리로 페이드한다. 3D 거리를 쓰면 3000m 탑뷰에서 전체가 균일하게
 *   어두워진다.
 * - **오버레이**: depthTest/depthWrite 를 모두 끄고 renderOrder 로만 순서를
 *   정한다(선택 박스 model-selection-box 와 같은 방식). 그래서 렌더러의
 *   logarithmicDepthBuffer 청크(sea-surface-material 참고)가 필요 없다 —
 *   depthTest 를 켜게 되면 그 청크를 함께 넣어야 한다.
 * - three 는 WebGL2 전용(`#version 300 es` 자동 삽입)이라 `fwidth` 가 기본
 *   제공된다. `#extension GL_OES_standard_derivatives` 를 넣으면 오히려
 *   ES 3.00 에서 에러다.
 */

/**
 * 격자 3단계. cell.size 는 **기본** 이동 스냅(SCENE_TRANSFORM_SNAP.translation
 * = 1m)과 같다. 사용자가 스냅 단위를 0.1/0.25m 로 바꿔도 격자는 따라가지
 * 않는다 — 방향·축척 보조가 목적이고, 0.1m 격자는 대형 지도에서 무아레가
 * 생긴다.
 */
export const GROUND_GRID_LEVELS = {
  cell: { size: 1, thickness: 1, color: '#545454' },
  section: { size: 10, thickness: 1, color: '#5e5e5e' },
  major: { size: 100, thickness: 1, color: '#6a6a6a' },
} as const;
/**
 * 선 전체 투명도. 블렌더 기본 테마의 격자(중간 회색 #545454, 알파 0.5)를
 * 따른다 — 배경에 섞여 은은하게 보이고, 단계 구분은 두께가 아니라 색으로만.
 */
export const GROUND_GRID_OPACITY = 0.5;
/** 평면 반경(m). 카메라 XZ 를 중심으로 깔리며 far(50000) 안에 들어온다. */
export const GROUND_GRID_HALF_EXTENT = 6000;
export const GROUND_GRID_PLANE_SIZE = GROUND_GRID_HALF_EXTENT * 2;
/** 평면 가장자리를 숨기는 카메라 XZ 거리 페이드 [시작, 끝]. 끝 < HALF_EXTENT 여야 경계가 안 보인다. */
export const GROUND_GRID_EDGE_FADE = { start: 3600, end: 5400 } as const;
/** 셀당 픽셀이 이 아래면 그 단계를 지운다 [완전 소멸, 페이드 시작]. */
export const GROUND_GRID_LOD_FADE_PX = { end: 4, start: 12 } as const;
/** 씬 객체(0) 위, 선택 박스(1)·기즈모(Infinity) 아래. */
export const GROUND_GRID_RENDER_ORDER = 0.5;

// ShaderMaterial.uniforms 가 인덱스 시그니처를 요구해 Record 를 확장한다.
export interface GroundGridUniforms extends Record<string, IUniform> {
  /** (cell, section, major) 셀 크기(m). */
  uSizes: { value: Vector3 };
  /** 단계별 선 두께(px). */
  uThickness: { value: Vector3 };
  uCellColor: { value: Color };
  uSectionColor: { value: Color };
  uMajorColor: { value: Color };
  uOpacity: { value: number };
  /** (start, end) m — 카메라 XZ 거리 페이드. */
  uEdgeFade: { value: Vector2 };
  /** (end, start) 셀당 px — 단계 LOD 페이드. */
  uLodFadePx: { value: Vector2 };
}

export interface GroundGridMaterialOptions {
  /** (cell, section, major). 유한·양수·엄격 증가여야 한다. */
  sizes?: [number, number, number];
  /** 단계별 선 두께(px). 음수는 0 으로. */
  thickness?: [number, number, number];
  /** [0,1] 로 클램프. */
  opacity?: number;
  edgeFade?: { start: number; end: number };
}

export type GroundGridMaterial = ShaderMaterial & {
  uniforms: GroundGridUniforms;
};

const vertexShader = /* glsl */ `
#include <common>

varying vec3 vWorldPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const fragmentShader = /* glsl */ `
#include <common>

uniform vec3 uSizes;
uniform vec3 uThickness;
uniform vec3 uCellColor;
uniform vec3 uSectionColor;
uniform vec3 uMajorColor;
uniform float uOpacity;
uniform vec2 uEdgeFade;
uniform vec2 uLodFadePx;

varying vec3 vWorldPos;

// 한 단계의 선 커버리지 × 화면 밀도 LOD.
// r = 셀 좌표, fwidth(r) = 픽셀당 셀 수. 커버리지는 선까지의 픽셀 거리로 만든
// 1px 안티에일리어스 선을 thickness 만큼 넓힌 것(drei Grid 와 같은 식).
float gridLevel(vec2 p, float size, float thickness) {
  vec2 r = p / size;
  vec2 fw = fwidth(r);
  vec2 distPx = abs(fract(r - 0.5) - 0.5) / max(fw, vec2(1e-6));
  float coverage = 1.0 - clamp(min(distPx.x, distPx.y) + 1.0 - thickness, 0.0, 1.0);
  float pxPerCell = 1.0 / max(max(fw.x, fw.y), 1e-6);
  float lod = smoothstep(uLodFadePx.x, uLodFadePx.y, pxPerCell);
  return coverage * lod;
}

void main() {
  vec2 p = vWorldPos.xz;
  float a1 = gridLevel(p, uSizes.x, uThickness.x);
  float a2 = gridLevel(p, uSizes.y, uThickness.y);
  float a3 = gridLevel(p, uSizes.z, uThickness.z);
  float a = max(a1, max(a2, a3));

  // 평면은 카메라 XZ 를 중심으로 깔리므로 카메라 XZ 거리 = 평면 중심 거리.
  float edge = 1.0 - smoothstep(uEdgeFade.x, uEdgeFade.y, distance(p, cameraPosition.xz));
  float alpha = a * edge * uOpacity;
  if (alpha < 0.002) discard;

  // 굵은 단계가 있는 곳은 그 색이 이긴다(section 선은 항상 cell 선과 겹친다).
  float inv = 1.0 / max(a, 1e-4);
  vec3 color = uCellColor;
  color = mix(color, uSectionColor, clamp(a2 * inv, 0.0, 1.0));
  color = mix(color, uMajorColor, clamp(a3 * inv, 0.0, 1.0));

  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`ground grid ${name} must be finite, got ${value}`);
  }
}

function resolveSizes(
  sizes: [number, number, number],
): [number, number, number] {
  sizes.forEach((size) => assertFinite(size, 'size'));
  if (!(sizes[0] > 0 && sizes[0] < sizes[1] && sizes[1] < sizes[2])) {
    throw new RangeError(
      `ground grid sizes must be positive and strictly increasing, got [${sizes.join(', ')}]`,
    );
  }
  return sizes;
}

function resolveThickness(
  thickness: [number, number, number],
): [number, number, number] {
  thickness.forEach((value) => assertFinite(value, 'thickness'));
  return [
    Math.max(0, thickness[0]),
    Math.max(0, thickness[1]),
    Math.max(0, thickness[2]),
  ];
}

function resolveOpacity(opacity: number): number {
  assertFinite(opacity, 'opacity');
  return Math.min(1, Math.max(0, opacity));
}

export function createGroundGridMaterial(
  options: GroundGridMaterialOptions = {},
): GroundGridMaterial {
  const sizes = resolveSizes(
    options.sizes ?? [
      GROUND_GRID_LEVELS.cell.size,
      GROUND_GRID_LEVELS.section.size,
      GROUND_GRID_LEVELS.major.size,
    ],
  );
  const thickness = resolveThickness(
    options.thickness ?? [
      GROUND_GRID_LEVELS.cell.thickness,
      GROUND_GRID_LEVELS.section.thickness,
      GROUND_GRID_LEVELS.major.thickness,
    ],
  );
  const opacity = resolveOpacity(options.opacity ?? GROUND_GRID_OPACITY);
  const edgeFade = options.edgeFade ?? GROUND_GRID_EDGE_FADE;

  // 호출마다 새 인스턴스 — 유니폼 객체를 재질끼리 공유하면 한쪽 조정이 번진다.
  const uniforms: GroundGridUniforms = {
    uSizes: { value: new Vector3(...sizes) },
    uThickness: { value: new Vector3(...thickness) },
    uCellColor: { value: new Color(GROUND_GRID_LEVELS.cell.color) },
    uSectionColor: { value: new Color(GROUND_GRID_LEVELS.section.color) },
    uMajorColor: { value: new Color(GROUND_GRID_LEVELS.major.color) },
    uOpacity: { value: opacity },
    uEdgeFade: { value: new Vector2(edgeFade.start, edgeFade.end) },
    uLodFadePx: {
      value: new Vector2(
        GROUND_GRID_LOD_FADE_PX.end,
        GROUND_GRID_LOD_FADE_PX.start,
      ),
    },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });
  return material as GroundGridMaterial;
}
