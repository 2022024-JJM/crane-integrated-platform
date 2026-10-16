import {
  AlwaysStencilFunc,
  Color,
  FrontSide,
  GreaterDepth,
  KeepStencilOp,
  Mesh,
  NotEqualStencilFunc,
  ReplaceStencilOp,
  ShaderMaterial,
} from 'three';
import { PLAN_HIDDEN_STENCIL_BIT } from './scene-stencil';

/**
 * 평면도 숨은선 — 다른 장비 아래 가려진 장비를 제도 관례대로 "숨은선"
 * (어두운 점무늬)으로 위 장비를 뚫고 보여 준다. 위에서 본 CC-02 지브가 TC-94 타워를
 * 지나갈 때 타워가 지브 아래 어디까지 있는지 읽힌다.
 *
 * 메쉬마다 같은 geometry 를 쓰는 오버레이 메쉬 셋을 자식으로 붙인다(실루엣
 * 마스크와 같은 방식 — 부모 transform 을 상속해 리그가 움직여도 따라간다).
 * 세 패스는 **모델마다 묶음으로 연속** 그려져야 한다(renderOrder 로 보장):
 *
 * 1. 가시 표식: 깊이 테스트(LessEqual)를 통과하는 픽셀 = 이 모델이 가장
 *    앞에 보이는 픽셀에 스텐실 비트를 찍는다(색·깊이는 쓰지 않는다).
 * 2. 빗금: 깊이가 **더 뒤**(GreaterDepth = 무언가에 가려짐)이면서 1 의 비트가
 *    없는 픽셀만 그린다 — 자기 자신(지브 상현재가 하현재를 가리는 자리)에는
 *    1 이 찍혀 있어 빗금이 생기지 않고, 남의 장비 아래만 남는다.
 * 3. 비트 지우기: 다음 모델이 깨끗한 비트로 시작한다.
 *
 * 한 모델의 세 패스 사이에 다른 모델의 패스가 끼면 2 가 남의 가시 표식을
 * 자기 것으로 읽어 빗금이 빠진다 — 순서는 `planHiddenLineRenderOrder` 로
 * 모델 인덱스마다 떨어뜨린다. 머티리얼은 전부 유니폼 없는 공유본이라 dispose
 * 하지 않는다. 캔버스에 스텐실이 없으면 1·3 이 무시되고 2 가 자기 가림까지
 * 빗금 치므로 스텐실 캔버스(모니터링·3D 플레이)에서만 쓴다.
 */

/**
 * transparent 리스트에서 평면도 윤곽 헐(10.4) 앞. 세 패스 모두 transparent 로
 * 보내 한 리스트 안에서 연속하고(마스크와 다른 리스트에 흩어지면 순서 계약이
 * 깨진다) 점이 알파로 섞인다. 깊이 버퍼는 불투명 패스 결과 그대로다(바다 등
 * transparent 는 깊이를 쓰지 않는다).
 */
export const PLAN_HIDDEN_RENDER_ORDER = 10.3;
/** 모델 하나가 차지하는 순서 폭(세 패스). */
const PLAN_HIDDEN_ORDER_SPAN = 0.0003;
const PLAN_HIDDEN_ORDER_STEP = 0.0001;

/** 점 색 — 평면도 윤곽(PLAN_VIEW_OUTLINE_COLOR)과 같은 어두운 난색. */
export const PLAN_HIDDEN_LINE_COLOR = '#2a1d10';
/** 점 불투명도 — 위 장비 색이 비치게 섞어 "아래에 무언가 있다" 정도로만. */
export const PLAN_HIDDEN_LINE_OPACITY = 0.45;
/** 점 격자 주기·점 크기(화면 px) — 25% 덮는 어두운 점무늬. 빗금은 확대·축소에
 * 따라 모아레가 생기고 지도 균열선과 섞여 점으로 바꿨다. */
export const PLAN_HIDDEN_DOT_PERIOD_PX = 5;
export const PLAN_HIDDEN_DOT_SIZE_PX = 2;

/**
 * 모델 인덱스(겹침 목록에서의 자리)와 패스(0·1·2)의 renderOrder — 같은
 * 모델의 세 패스가 연속하고 모델끼리는 겹치지 않는다.
 */
export function planHiddenLineRenderOrder(index: number, pass: number): number {
  return (
    PLAN_HIDDEN_RENDER_ORDER +
    index * PLAN_HIDDEN_ORDER_SPAN +
    pass * PLAN_HIDDEN_ORDER_STEP
  );
}

/**
 * 세 패스 모두 깊이를 **three 의 메쉬 셰이더와 같은 경로**로 쓴다
 * (logdepthbuf 청크). 캔버스가 로그 깊이 버퍼라 메쉬 셰이더는 gl_FragDepth 를
 * 직접 쓰는데, 이 패스가 고정 파이프라인 깊이를 그대로 두면 같은 면의 깊이가
 * 변환 정밀도만큼 어긋나 "같은 면" 비교(LessEqual·Greater)가 뒤집힌다 —
 * 가려지지 않은 면에까지 점이 찍혔던 원인이다.
 */
const PASS_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const NOOP_FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  gl_FragColor = vec4(0.0);
}
`;

const HATCH_FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
uniform float uPeriod;
uniform float uWidth;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = mod(gl_FragCoord.xy, uPeriod);
  if (c.x >= uWidth || c.y >= uWidth) discard;
  gl_FragColor = vec4(uColor, uOpacity);
}
`;

/** 1. 가시 표식 — 색·깊이 쓰기 없음, 깊이 통과 픽셀에 비트 Replace. */
const visibleMarkMaterial = new ShaderMaterial({
  vertexShader: PASS_VERTEX,
  fragmentShader: NOOP_FRAGMENT,
  side: FrontSide,
  transparent: true,
  colorWrite: false,
  depthTest: true,
  depthWrite: false,
  stencilWrite: true,
  stencilRef: PLAN_HIDDEN_STENCIL_BIT,
  stencilFunc: AlwaysStencilFunc,
  stencilFuncMask: PLAN_HIDDEN_STENCIL_BIT,
  stencilWriteMask: PLAN_HIDDEN_STENCIL_BIT,
  stencilFail: KeepStencilOp,
  stencilZFail: KeepStencilOp,
  stencilZPass: ReplaceStencilOp,
});
visibleMarkMaterial.name = 'plan-hidden-line-mark';

/** 2. 빗금 — 가려진(GreaterDepth) 픽셀 중 비트가 없는 곳만. */
const hatchMaterial = new ShaderMaterial({
  uniforms: {
    uColor: { value: new Color(PLAN_HIDDEN_LINE_COLOR) },
    uOpacity: { value: PLAN_HIDDEN_LINE_OPACITY },
    uPeriod: { value: PLAN_HIDDEN_DOT_PERIOD_PX },
    uWidth: { value: PLAN_HIDDEN_DOT_SIZE_PX },
  },
  vertexShader: PASS_VERTEX,
  fragmentShader: HATCH_FRAGMENT,
  side: FrontSide,
  transparent: true,
  depthTest: true,
  depthFunc: GreaterDepth,
  depthWrite: false,
  stencilWrite: true,
  stencilWriteMask: 0,
  stencilRef: PLAN_HIDDEN_STENCIL_BIT,
  stencilFunc: NotEqualStencilFunc,
  stencilFuncMask: PLAN_HIDDEN_STENCIL_BIT,
  stencilFail: KeepStencilOp,
  stencilZFail: KeepStencilOp,
  stencilZPass: KeepStencilOp,
});
hatchMaterial.name = 'plan-hidden-line-hatch';

/** 3. 비트 지우기 — 깊이 무관, 모든 프래그먼트에서 비트를 0 으로. */
const clearMarkMaterial = new ShaderMaterial({
  vertexShader: PASS_VERTEX,
  fragmentShader: NOOP_FRAGMENT,
  side: FrontSide,
  transparent: true,
  colorWrite: false,
  depthTest: false,
  depthWrite: false,
  stencilWrite: true,
  stencilRef: 0,
  stencilFunc: AlwaysStencilFunc,
  stencilFuncMask: PLAN_HIDDEN_STENCIL_BIT,
  stencilWriteMask: PLAN_HIDDEN_STENCIL_BIT,
  stencilFail: ReplaceStencilOp,
  stencilZFail: ReplaceStencilOp,
  stencilZPass: ReplaceStencilOp,
});
clearMarkMaterial.name = 'plan-hidden-line-clear';

const PASS_MATERIALS = [
  visibleMarkMaterial,
  hatchMaterial,
  clearMarkMaterial,
] as const;
const PASS_NAMES = [
  'plan-hidden-line-mark',
  'plan-hidden-line-hatch',
  'plan-hidden-line-clear',
] as const;

/** 테스트·진단용 — 패스별 공유 머티리얼. */
export function planHiddenLineMaterials(): readonly ShaderMaterial[] {
  return PASS_MATERIALS;
}

/**
 * 대상 메쉬에 자식으로 붙일 세 패스 메쉬. geometry 는 대상 것을 공유하고
 * (dispose 금지), 머티리얼은 모듈 공유본이다. raycast·그림자는 끊는다
 * (실루엣 오버레이와 같은 이유).
 */
export function createPlanHiddenLineMeshes(
  target: Mesh,
  index: number,
): Mesh[] {
  return PASS_MATERIALS.map((material, pass) => {
    const mesh = new Mesh(target.geometry, material);
    mesh.raycast = () => {};
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = target.frustumCulled;
    mesh.renderOrder = planHiddenLineRenderOrder(index, pass);
    mesh.name = PASS_NAMES[pass];
    return mesh;
  });
}
