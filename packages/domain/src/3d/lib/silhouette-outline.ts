import {
  AlwaysStencilFunc,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  NotEqualStencilFunc,
  ReplaceStencilOp,
  ShaderMaterial,
  type BufferGeometry,
} from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { markOverlayMesh } from './overlay-mesh';

/**
 * 일체형 실루엣 테두리 — 스텐실 마스크 + 인플레이션 헐.
 * 충돌 하이라이트(빨강)와 에디터 선택 표시(노랑)가 같은 구현을 쓴다.
 * 컴포넌트 배선은 ui/object-silhouette-outline.tsx.
 *
 * 두 패스로 그린다:
 * 1. **마스크**: 대상 모델(들)의 모든 메시를 원본 geometry 그대로 한 번 더
 *    그리되 색·깊이는 쓰지 않고 스텐실에만 발자국(ref=1)을 찍는다.
 * 2. **헐**: 각 메시의 geometry 를 뷰 공간 노멀 방향으로 화면 픽셀 두께만큼
 *    부풀려 원색으로 그리되, 스텐실이 발자국인 픽셀은 버린다(NotEqual).
 *
 * 발자국은 대상 모델 **전체의 합집합**이므로 메시 사이·모델 사이 내부
 * 경계선이 전부 지워지고, 합쳐진 실루엣을 두르는 테두리 하나만 남는다.
 * 두 패스 모두 depthTest/depthWrite 를 끈 오버레이(renderOrder)라서:
 * - 장애물에 가려진 부분도 테두리가 보인다(X-ray).
 * - 렌더러의 logarithmicDepthBuffer 와 전혀 얽히지 않는다. 이전 구현(뷰 깊이
 *   밀어넣기로 본체가 이기게 하는 inverted hull)은 raw ShaderMaterial 이
 *   표준 z 를 쓰는데 씬 전체는 로그 깊이라 비교가 어긋나 테두리가 통째로
 *   탈락했다(scene-render-preset.tsx SCENE_GL_OPTIONS 주석의 함정, 실측
 *   2026-09-08). 스텐실 방식은 깊이를 아예 읽지도 쓰지도 않는다.
 *
 * **캔버스 전제: WebGL 컨텍스트에 스텐실 버퍼가 있어야 한다**
 * (`SCENE_GL_OPTIONS.stencil: true` — 에디터·모니터링·리플레이는 켜져 있다).
 * 스텐실이 없는 캔버스에선 테스트가 항상 통과해 헐이 모델을 통째로 덮는다 —
 * mro2·philly 존 뷰어처럼 자체 Canvas 를 쓰는 곳에 이 오버레이를 붙이려면
 * gl 옵션부터 확인할 것.
 *
 * 헐을 drei `Outlines` 로 만들지 않는 이유(실측, 2026-09-08):
 * - drei 의 clip-space 오프셋(`normalize(clipNormal.xy)`)은 정면 노멀에서
 *   NaN 이 되어 삼각형이 버려진다 — 아웃라인이 끊기거나 아예 안 보인다.
 * - BackSide 컬링 기반이라 지오메트리 와인딩이 뒤집힌 메시(골리앗 빔 등 —
 *   모델 재질이 DoubleSide 라 원본 렌더에선 티가 안 난다)에서 앞면을 통째로
 *   덮는다. 그래서 헐은 DoubleSide 로 그리고 컬링·깊이 대신 스텐실이
 *   실루엣을 만든다.
 *
 * 헐·마스크는 대상 메시의 자식으로 마운트한다 — 리그 드라이버·기즈모의
 * 움직임을 씬 그래프 상속으로 따라간다.
 */

/** 테두리 화면 두께(px). */
export const SILHOUETTE_OUTLINE_PX = 4;

/** 발자국 스텐실 값. autoClearStencil(기본 on)이 매 프레임 지운다. */
const STENCIL_REF = 1;

/**
 * 렌더 순서 — 기존 오버레이(선택 박스 1, collision-guard 1~5) 뒤에 온다.
 * 마스크(opaque 리스트)는 어차피 모든 transparent 앞에 그려지지만, 헐은
 * transparent 리스트에서 바다·가드 링 등보다 뒤여야 테두리가 덮이지 않는다.
 */
const MASK_RENDER_ORDER = 10;
const OUTLINE_RENDER_ORDER = 11;

const VERTEX_SHADER = /* glsl */ `
  uniform float uOffsetFactor; // 두께px × (2·tan(fov/2) / 뷰포트 높이px)
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // -z = 카메라 앞 깊이. 깊이에 비례해 부풀리면 화면상 두께가 상수가 된다.
    // 노멀은 뷰 공간 3D(normalMatrix 경유) — KHR_mesh_quantization 의 노드
    // 스케일도 자동 보정된다.
    float offsetMag = uOffsetFactor * max(-mvPosition.z, 0.0);
    vec3 nView = normalize(normalMatrix * normal);
    mvPosition.xyz += nView * offsetMag;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

/**
 * px 두께를 뷰 깊이 1 기준 월드 오프셋으로 바꾸는 화면 계수.
 * (투영: 화면px = world / (depth · 2·tan(fov/2) / heightPx) 의 역산)
 */
export function outlineOffsetFactor(
  thicknessPx: number,
  fovDeg: number,
  viewportHeightPx: number,
): number {
  if (viewportHeightPx <= 0) return 0;
  return (
    (thicknessPx * 2 * Math.tan((fovDeg * Math.PI) / 360)) / viewportHeightPx
  );
}

/**
 * 마스크 공용 머티리얼 — 색·깊이를 안 쓰고 스텐실 발자국만 찍는다. 상태가
 * 전혀 없어 모듈 싱글턴 하나를 모든 마스크 메시·캔버스가 공유한다(three 는
 * 렌더러별 프로그램을 머티리얼 키의 WeakMap 으로 들므로 캔버스 간 공유도
 * 안전하다). dispose 하지 않는다.
 */
const silhouetteMaskMaterial = new MeshBasicMaterial({
  colorWrite: false,
  depthWrite: false,
  depthTest: false,
  side: DoubleSide,
  stencilWrite: true,
  stencilRef: STENCIL_REF,
  stencilFunc: AlwaysStencilFunc,
  stencilZPass: ReplaceStencilOp,
});

/**
 * 헐용 스무딩 노멀 지오메트리 캐시.
 *
 * 이 GLB 들은 하드서페이스라 노멀이 면 단위로 분리(flat)돼 있는데, 그런
 * 노멀로 인플레이션하면 각 면이 자기 평면의 법선 방향으로 평행이동할 뿐
 * **실루엣이 커지지 않는다** — 화면과 나란한 측면은 밀려도 여전히 0px 로
 * 투영되어 테두리가 아예 안 생긴다(실측으로 확인한 함정. drei Outlines 가
 * toCreasedNormals 를 쓰는 이유가 이것이다). 그래서 정점을 위치 기준으로
 * 병합해 평균 노멀을 만든 사본을 쓴다.
 *
 * 사본은 원본 geometry 를 키로 캐시한다 — 같은 GLB 의 다른 인스턴스
 * (LLC 2대 등)와 반복 선택·충돌이 재계산하지 않도록. 원본이 dispose 되면
 * (region 이탈 시 GLTF 캐시 해제) 'dispose' 이벤트를 받아 같이 정리한다.
 */
const smoothedGeometryCache = new WeakMap<BufferGeometry, BufferGeometry>();

/** 스무딩 사본이 이미 있는지 — 워밍업 큐가 중복 작업을 거를 때 쓴다. */
export function hasSilhouetteOutlineGeometry(source: BufferGeometry): boolean {
  return smoothedGeometryCache.has(source);
}

/**
 * 스무딩 사본을 만들어 두기만 한다(있으면 no-op). 첫 선택·첫 충돌 때 100~200ms
 * 짜리 동기 계산이 프레임을 세우지 않도록 `bvhBuildQueue` 가 로딩 뒤 슬라이스로
 * 미리 부른다. 반환값은 헐 생성이 그대로 쓰는 캐시 항목이다.
 */
export function warmSilhouetteOutlineGeometry(
  source: BufferGeometry,
): BufferGeometry {
  const cached = smoothedGeometryCache.get(source);
  if (cached) return cached;
  // creaseAngle=π — 모든 엣지를 스무딩해 정점당 평균 노멀 하나를 만든다.
  const smoothed = toCreasedNormals(source, Math.PI);
  smoothedGeometryCache.set(source, smoothed);
  const onSourceDispose = () => {
    source.removeEventListener('dispose', onSourceDispose);
    smoothedGeometryCache.delete(source);
    smoothed.dispose();
  };
  source.addEventListener('dispose', onSourceDispose);
  return smoothed;
}

function detachOverlayMesh(mesh: Mesh): void {
  // 씬 순회가 이 메시를 실제 콘텐츠로 착각하지 않게 표식을 남긴다 — 충돌
  // 감지가 마스크(대상 지오메트리 재사용)와 헐(BVH 없는 사본)을 수집하던
  // 결함의 차단점이다. 경위는 overlay-mesh.ts 주석.
  markOverlayMesh(mesh);
  // raycast 는 끊는다 — 오버레이는 BVH(boundsTree)가 없어 그대로 두면 포인터
  // 이동마다 수만 삼각형 브루트포스 raycast 대상이 된다.
  mesh.raycast = () => {};
  // 그림자 depth pass 에 끼면 실루엣이 그림자를 두껍게 만든다.
  mesh.castShadow = false;
  mesh.receiveShadow = false;
}

/**
 * 헐 머티리얼 — 발자국(스텐실) 밖에서만 그려지는 원색 오버레이. 한 표시
 * 단위의 모든 헐 메시가 하나를 공유한다(uOffsetFactor 가 캔버스 단위 값
 * 이라 개별로 둘 이유가 없다). 호출자가 dispose 한다.
 */
export function createSilhouetteOutlineMaterial(color: string): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uColor: { value: new Color(color) },
      uOffsetFactor: { value: 0 },
    },
    side: DoubleSide,
    // transparent — 블렌딩용이 아니라(알파 1) transparent 렌더 리스트로
    // 보내 renderOrder 가 바다 등 다른 transparent 뒤에 오게 하기 위함.
    transparent: true,
    depthTest: false,
    depthWrite: false,
    stencilWrite: true, // three 에선 이 플래그가 스텐실 "테스트" 도 켠다
    stencilWriteMask: 0, // 테스트만 하고 값은 건드리지 않는다
    stencilRef: STENCIL_REF,
    stencilFunc: NotEqualStencilFunc,
    // 톤매핑·포그를 타지 않는 원색. ShaderMaterial 은 기본으로 둘 다
    // 포함하지 않으므로 별도 처리 없음.
  });
}

/**
 * 대상 메시에 자식으로 붙일 스텐실 마스크 메시. geometry 는 대상과 공유하고
 * 머티리얼은 모듈 싱글턴이라 지울 때 dispose 할 것이 없다.
 */
export function createSilhouetteMaskMesh(target: Mesh): Mesh {
  const mask = new Mesh(target.geometry, silhouetteMaskMaterial);
  detachOverlayMesh(mask);
  mask.renderOrder = MASK_RENDER_ORDER;
  mask.name = 'silhouette-outline-mask';
  return mask;
}

/**
 * 대상 메시에 자식으로 붙일 헐 메시. geometry 는 스무딩 사본 캐시(위)를
 * 쓴다 — 헐을 지울 때 geometry 를 dispose 하면 안 된다(캐시 소유).
 * material 은 공유본이라 소유자(생성한 컴포넌트)가 dispose 한다.
 */
export function createSilhouetteOutlineHull(
  target: Mesh,
  material: ShaderMaterial,
): Mesh {
  const hull = new Mesh(
    warmSilhouetteOutlineGeometry(target.geometry),
    material,
  );
  detachOverlayMesh(hull);
  hull.renderOrder = OUTLINE_RENDER_ORDER;
  hull.name = 'silhouette-outline';
  return hull;
}
