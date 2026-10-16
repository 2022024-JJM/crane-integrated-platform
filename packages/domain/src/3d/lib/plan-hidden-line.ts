import {
  AlwaysStencilFunc,
  Color,
  DoubleSide,
  EqualStencilFunc,
  GreaterDepth,
  KeepStencilOp,
  Mesh,
  NotEqualStencilFunc,
  PlaneGeometry,
  ReplaceStencilOp,
  ShaderMaterial,
} from 'three';
import {
  PLAN_HIDDEN_REGION_STENCIL_BIT,
  PLAN_HIDDEN_STENCIL_BIT,
} from './scene-stencil';
import { warmSilhouetteOutlineGeometry } from './silhouette-outline';

/**
 * 평면도 숨은선 — 다른 장비 아래 가려진 장비를 위 장비를 뚫고 옅은 단색으로
 * 깔고, 가려진 실루엣에 가는 윤곽을 두른다(Revit 언더레이가 아래 층을 반톤으로
 * 보이는 방식). 위에서 본 CC-02 지브가 TC-94 타워를 지나갈 때 타워가 지브
 * 아래 어디까지 있는지 읽힌다.
 *
 * 모델마다 다섯 패스를 **연속으로** 그린다(renderOrder 로 보장). 메쉬 패스는
 * 메쉬마다 같은 geometry 의 오버레이 메쉬를 자식으로 붙이고(부모 transform 을
 * 상속해 리그가 움직여도 따라간다), 채움은 모델당 화면 쿼드 하나다.
 *
 * 1. 보임 표식(V 비트): 깊이 테스트(LessEqual)를 통과하는 픽셀 = 이 모델이
 *    가장 앞에 보이는 픽셀. 색·깊이는 쓰지 않는다.
 * 2. 가려짐 표식(H 비트): 깊이가 **더 뒤**(GreaterDepth = 무언가에 가려짐)
 *    이면서 V 가 없는 픽셀. 자기 자신(지브 상현재가 하현재를 가리는 자리)에는
 *    V 가 찍혀 있어 빠지고, 남의 장비 아래만 남는다.
 * 3. 채움: 화면 쿼드가 H 픽셀만 단색으로 칠한다 — 부재가 몇 겹이든 한 층이라
 *    진하기가 균일하다(메쉬마다 칠하면 겹친 만큼 진해져 격자가 얼룩진다).
 * 4. 윤곽: 스무딩 노멀 헐(실루엣 윤곽과 같은 캐시)을 화면 px 만큼 부풀려
 *    GreaterDepth 로 그리되 V·H 가 모두 없는 픽셀만 — 가려진 실루엣 바깥 띠만
 *    남고, 위 장비 밖(헐이 더 앞이라 깊이 탈락)과 자기 발자국 안에는 없다.
 * 5. 지우기: V·H 를 0 으로 — 다음 모델이 깨끗한 비트로 시작한다.
 *
 * 한 모델의 패스 사이에 다른 모델의 패스가 끼면 남의 표식을 자기 것으로 읽는다
 * — 순서는 `planHiddenLineRenderOrder` 로 모델 인덱스마다 떨어뜨린다. 표식·
 * 지우기는 양면으로 그린다(와인딩이 뒤집힌 메쉬가 와도 보이는 면을 놓치지
 * 않게). 모델의 **모든** 메쉬에 붙인다 — 큰 몸체를 빼면 그 아래 자기 부재가
 * "표식 없는 무언가에 가려진 것" 이 되어 고스트가 된다. 캔버스에 스텐실이
 * 없으면 표식이 무시되고 쿼드가 화면 전체를 칠하므로 스텐실 캔버스(모니터링·
 * 3D 플레이)에서만 쓴다.
 *
 * **깊이 비교는 본체 셰이더와 같은 값이어야 한다.** 1 은 "같거나 가깝다",
 * 2·4 는 "더 멀다" 로 본체가 쓴 깊이와 비교하므로, 정점 셰이더는 three 의
 * `project_vertex` 청크 그대로(modelViewMatrix 곱 뒤 projectionMatrix 곱)
 * 투영하고 로그 깊이도 같은 청크로 쓴다 — `projectionMatrix * modelViewMatrix
 * * position` 한 줄은 행렬끼리 먼저 곱해 반올림이 달라지고, 수평 평면은 면
 * 전체가 한쪽으로 기울어 통째로 고스트가 됐다(OC 기계실 데크·아웃리거 패드).
 * 여기에 깊이를 카메라 쪽으로 `PLAN_HIDDEN_DEPTH_BIAS` 만큼 당겨 같은 면은
 * 항상 "보임" 으로 판정한다. 가려짐은 깊이 버퍼 기준이라 땅 속으로 꺼진
 * 부재는 땅에 가려진 것으로 칠해진다.
 *
 * 공유 머티리얼(표식·채움·지우기)은 유니폼이 캔버스 무관이라 모듈 싱글턴이고
 * dispose 하지 않는다. 윤곽 머티리얼만 캔버스 뷰포트 기준 두께 유니폼이 있어
 * 표시 단위마다 만들고 소유자가 dispose 한다.
 */

/**
 * transparent 리스트에서 평면도 윤곽 헐(10.4) 앞. 모든 패스를 transparent 로
 * 보내 한 리스트 안에서 연속하고(마스크와 다른 리스트에 흩어지면 순서 계약이
 * 깨진다) 채움·윤곽이 알파로 섞인다. 깊이 버퍼는 불투명 패스 결과 그대로다
 * (바다 등 transparent 는 깊이를 쓰지 않는다).
 */
export const PLAN_HIDDEN_RENDER_ORDER = 10.3;
/** 모델 하나의 패스 수(순서 자리). */
export const PLAN_HIDDEN_PASS_COUNT = 5;
const PLAN_HIDDEN_ORDER_STEP = 0.0001;
/** 모델 하나가 차지하는 순서 폭. */
const PLAN_HIDDEN_ORDER_SPAN = PLAN_HIDDEN_ORDER_STEP * PLAN_HIDDEN_PASS_COUNT;

/** 패스 자리 — `planHiddenLineRenderOrder` 의 두 번째 인자. */
export const PLAN_HIDDEN_PASS = {
  markVisible: 0,
  markHidden: 1,
  fill: 2,
  outline: 3,
  clear: 4,
} as const;

/**
 * 채움 색 — 차가운 회청. 윤곽의 난색(PLAN_VIEW_OUTLINE_COLOR)·크레인 주황과
 * 모두 달라 "다른 층" 으로 읽힌다. 무늬(빗금·점)는 쓰지 않는다 — 빗금은
 * 확대·축소에 모아레가 생기고 지도 균열선과 섞였고, 점무늬는 형체가 흩어지고
 * 가까이서 노이즈로 읽혔다.
 */
export const PLAN_HIDDEN_LINE_COLOR = '#3c5c82';
/** 채움 불투명도 — 위 장비 색이 비치게 섞어 "아래에 무언가 있다" 정도로만. */
export const PLAN_HIDDEN_LINE_OPACITY = 0.45;
/** 가려진 실루엣 윤곽 — 채움과 같은 계열의 더 진한 회청, 가는 띠. */
export const PLAN_HIDDEN_OUTLINE_COLOR = '#27405c';
export const PLAN_HIDDEN_OUTLINE_PX = 1.5;
export const PLAN_HIDDEN_OUTLINE_OPACITY = 0.9;
/**
 * 깊이 바이어스(깊이 버퍼 단위, 카메라 쪽) — 본체와 같은 식으로 투영해도
 * 드라이버가 다르게 반올림할 여지를 덮고, 바닥에 딱 붙은 면(패드)이 바닥에
 * 가려진 것으로 잡히지 않게 한다. 이보다 얕게 가려진 것은 고스트가 안 된다.
 */
export const PLAN_HIDDEN_DEPTH_BIAS = 1e-6;

const V = PLAN_HIDDEN_STENCIL_BIT;
const H = PLAN_HIDDEN_REGION_STENCIL_BIT;
const DEPTH_BIAS_GLSL = PLAN_HIDDEN_DEPTH_BIAS.toExponential();

/**
 * 모델 인덱스(겹침 목록에서의 자리)와 패스 자리의 renderOrder — 같은 모델의
 * 패스가 연속하고 모델끼리는 겹치지 않는다.
 */
export function planHiddenLineRenderOrder(index: number, pass: number): number {
  return (
    PLAN_HIDDEN_RENDER_ORDER +
    index * PLAN_HIDDEN_ORDER_SPAN +
    pass * PLAN_HIDDEN_ORDER_STEP
  );
}

/** 메쉬 패스 정점 — 본체 메쉬 셰이더와 같은 청크·같은 순서로 투영한다. */
const MESH_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  #include <logdepthbuf_vertex>
}
`;

/**
 * 깊이 쓰기 — 본체와 같은 로그 깊이 청크 뒤에 카메라 쪽 바이어스. 로그 깊이가
 * 아닌 캔버스는 래스터 깊이에 같은 바이어스.
 */
const DEPTH_FRAGMENT = /* glsl */ `
  #include <logdepthbuf_fragment>
  #ifndef USE_LOGARITHMIC_DEPTH_BUFFER
  gl_FragDepth = gl_FragCoord.z;
  #endif
  gl_FragDepth -= ${DEPTH_BIAS_GLSL};
`;

const MARK_FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
void main() {
  ${DEPTH_FRAGMENT}
  gl_FragColor = vec4(0.0);
}
`;

/** 채움 쿼드 — 클립 공간 전체. 모델 행렬은 무시한다. */
const QUAD_VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * 색은 `colorspace_fragment` 로 출력 색공간에 맞춰 내보낸다 — 유니폼의 Color 는
 * 선형이라 그대로 쓰면 중간 톤이 한참 어둡게 찍힌다. 톤매핑은 거치지 않는다
 * (조명 결과가 아닌 표식 색).
 */
const FILL_FRAGMENT = /* glsl */ `
#include <common>
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(uColor, uOpacity);
  #include <colorspace_fragment>
}
`;

/** 윤곽 헐 정점 — 실루엣 윤곽과 같은 뷰 공간 인플레이션 + 로그 깊이. */
const OUTLINE_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uOffsetFactor; // 두께px × (2·tan(fov/2) / 뷰포트 높이px)
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float offsetMag = uOffsetFactor * max(-mvPosition.z, 0.0);
  vec3 nView = normalize(normalMatrix * normal);
  mvPosition.xyz += nView * offsetMag;
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
}
`;

const OUTLINE_FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  ${DEPTH_FRAGMENT}
  gl_FragColor = vec4(uColor, uOpacity);
  #include <colorspace_fragment>
}
`;

/** 지우기 — 깊이를 안 보므로 투영만. */
const CLEAR_VERTEX = /* glsl */ `
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const CLEAR_FRAGMENT = /* glsl */ `
void main() {
  gl_FragColor = vec4(0.0);
}
`;

/** 1. 보임 표식 — 색·깊이 쓰기 없음, 깊이 통과 픽셀에 V Replace. */
const markVisibleMaterial = new ShaderMaterial({
  vertexShader: MESH_VERTEX,
  fragmentShader: MARK_FRAGMENT,
  side: DoubleSide,
  transparent: true,
  colorWrite: false,
  depthTest: true,
  depthWrite: false,
  stencilWrite: true,
  stencilRef: V,
  stencilFunc: AlwaysStencilFunc,
  stencilFuncMask: V,
  stencilWriteMask: V,
  stencilFail: KeepStencilOp,
  stencilZFail: KeepStencilOp,
  stencilZPass: ReplaceStencilOp,
});
markVisibleMaterial.name = 'plan-hidden-mark-visible';

/** 2. 가려짐 표식 — 더 뒤(GreaterDepth)이면서 V 가 없는 픽셀에 H Replace. */
const markHiddenMaterial = new ShaderMaterial({
  vertexShader: MESH_VERTEX,
  fragmentShader: MARK_FRAGMENT,
  side: DoubleSide,
  transparent: true,
  colorWrite: false,
  depthTest: true,
  depthFunc: GreaterDepth,
  depthWrite: false,
  stencilWrite: true,
  // 비교는 V 비트만(NotEqual → V 가 0 인 픽셀), 쓰기는 H 비트만.
  stencilRef: V | H,
  stencilFunc: NotEqualStencilFunc,
  stencilFuncMask: V,
  stencilWriteMask: H,
  stencilFail: KeepStencilOp,
  stencilZFail: KeepStencilOp,
  stencilZPass: ReplaceStencilOp,
});
markHiddenMaterial.name = 'plan-hidden-mark-hidden';

/** 3. 채움 — 깊이 무관, H 픽셀만. */
const fillMaterial = new ShaderMaterial({
  uniforms: {
    uColor: { value: new Color(PLAN_HIDDEN_LINE_COLOR) },
    uOpacity: { value: PLAN_HIDDEN_LINE_OPACITY },
  },
  vertexShader: QUAD_VERTEX,
  fragmentShader: FILL_FRAGMENT,
  side: DoubleSide,
  transparent: true,
  depthTest: false,
  depthWrite: false,
  stencilWrite: true, // three 에선 이 플래그가 스텐실 "테스트" 도 켠다
  stencilWriteMask: 0,
  stencilRef: H,
  stencilFunc: EqualStencilFunc,
  stencilFuncMask: H,
  stencilFail: KeepStencilOp,
  stencilZFail: KeepStencilOp,
  stencilZPass: KeepStencilOp,
});
fillMaterial.name = 'plan-hidden-fill';

/** 5. 지우기 — 깊이 무관, 모든 프래그먼트에서 V·H 를 0 으로. */
const clearMaterial = new ShaderMaterial({
  vertexShader: CLEAR_VERTEX,
  fragmentShader: CLEAR_FRAGMENT,
  side: DoubleSide,
  transparent: true,
  colorWrite: false,
  depthTest: false,
  depthWrite: false,
  stencilWrite: true,
  stencilRef: 0,
  stencilFunc: AlwaysStencilFunc,
  stencilFuncMask: V | H,
  stencilWriteMask: V | H,
  stencilFail: ReplaceStencilOp,
  stencilZFail: ReplaceStencilOp,
  stencilZPass: ReplaceStencilOp,
});
clearMaterial.name = 'plan-hidden-clear';

const SHARED_MATERIALS = [
  markVisibleMaterial,
  markHiddenMaterial,
  fillMaterial,
  clearMaterial,
] as const;

/** 테스트·진단용 — 공유 머티리얼 [보임 표식, 가려짐 표식, 채움, 지우기]. */
export function planHiddenLineMaterials(): readonly ShaderMaterial[] {
  return SHARED_MATERIALS;
}

/**
 * 4. 윤곽 헐 머티리얼 — 더 뒤(GreaterDepth)이면서 V·H 둘 다 없는 픽셀만.
 * `uOffsetFactor` 는 캔버스 뷰포트 기준이라(model/use-outline-offset.ts)
 * 표시 단위마다 만들고 호출자가 dispose 한다.
 */
export function createPlanHiddenOutlineMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(PLAN_HIDDEN_OUTLINE_COLOR) },
      uOpacity: { value: PLAN_HIDDEN_OUTLINE_OPACITY },
      uOffsetFactor: { value: 0 },
    },
    vertexShader: OUTLINE_VERTEX,
    fragmentShader: OUTLINE_FRAGMENT,
    side: DoubleSide,
    transparent: true,
    depthTest: true,
    depthFunc: GreaterDepth,
    depthWrite: false,
    stencilWrite: true,
    stencilWriteMask: 0,
    stencilRef: 0,
    stencilFunc: EqualStencilFunc,
    stencilFuncMask: V | H,
    stencilFail: KeepStencilOp,
    stencilZFail: KeepStencilOp,
    stencilZPass: KeepStencilOp,
  });
}

/** 채움 쿼드 geometry — 클립 공간 [-1,1]². 공유본, dispose 하지 않는다. */
const FILL_QUAD_GEOMETRY = new PlaneGeometry(2, 2);

function detachOverlayMesh(mesh: Mesh): void {
  // raycast 는 끊는다 — 오버레이는 BVH 가 없어 포인터마다 브루트포스가 된다.
  mesh.raycast = () => {};
  mesh.castShadow = false;
  mesh.receiveShadow = false;
}

/**
 * 대상 메쉬에 자식으로 붙일 메쉬 패스 넷 [보임 표식, 가려짐 표식, 윤곽 헐,
 * 지우기]. 표식·지우기는 대상 geometry 를 공유하고(dispose 금지), 윤곽은
 * 스무딩 헐 캐시(실루엣 윤곽과 공유, 캐시 소유)를 쓴다. 공유 머티리얼은
 * 모듈 싱글턴, `outlineMaterial` 은 호출자 소유다.
 */
export function createPlanHiddenLineMeshes(
  target: Mesh,
  index: number,
  outlineMaterial: ShaderMaterial,
): Mesh[] {
  const markVisible = new Mesh(target.geometry, markVisibleMaterial);
  markVisible.renderOrder = planHiddenLineRenderOrder(
    index,
    PLAN_HIDDEN_PASS.markVisible,
  );
  markVisible.name = 'plan-hidden-mark-visible';

  const markHidden = new Mesh(target.geometry, markHiddenMaterial);
  markHidden.renderOrder = planHiddenLineRenderOrder(
    index,
    PLAN_HIDDEN_PASS.markHidden,
  );
  markHidden.name = 'plan-hidden-mark-hidden';

  const outline = new Mesh(
    warmSilhouetteOutlineGeometry(target.geometry),
    outlineMaterial,
  );
  outline.renderOrder = planHiddenLineRenderOrder(
    index,
    PLAN_HIDDEN_PASS.outline,
  );
  outline.name = 'plan-hidden-outline';

  const clear = new Mesh(target.geometry, clearMaterial);
  clear.renderOrder = planHiddenLineRenderOrder(index, PLAN_HIDDEN_PASS.clear);
  clear.name = 'plan-hidden-clear';

  const passes = [markVisible, markHidden, outline, clear];
  for (const pass of passes) {
    detachOverlayMesh(pass);
    pass.frustumCulled = target.frustumCulled;
  }
  return passes;
}

/**
 * 모델당 하나인 채움 쿼드 — 씬 그래프 어디에 두든 화면 전체를 덮는다(정점
 * 셰이더가 모델 행렬을 무시). 절두체 컬링을 끄지 않으면 부모 위치로 컬링된다.
 */
export function createPlanHiddenFillQuad(index: number): Mesh {
  const quad = new Mesh(FILL_QUAD_GEOMETRY, fillMaterial);
  detachOverlayMesh(quad);
  quad.frustumCulled = false;
  quad.renderOrder = planHiddenLineRenderOrder(index, PLAN_HIDDEN_PASS.fill);
  quad.name = 'plan-hidden-fill';
  return quad;
}
