import {
  DoubleSide,
  Mesh,
  NotEqualStencilFunc,
  type Material,
  type IUniform,
} from 'three';
import { applyPlanViewPatch } from './plan-view-patch';
import { SILHOUETTE_STENCIL_BIT } from './scene-stencil';
import { applySeaSubmersion } from './sea-submersion';
import { hasShaderPatch, setShaderPatch } from './shader-patch';
import { warmSilhouetteOutlineGeometry } from './silhouette-outline';

/**
 * 평면도 채움(두껍게 그리기) — 위에서 본 격자 지브는 부재가 1~2px 라
 * 선회할 때 생겼다 사라지며 반짝인다. 메쉬마다 실루엣 헐(스무딩 노멀 사본)을
 * **메쉬 자기 색**으로 화면 PLAN_FILL_PX 만큼 부풀려 한 번 더 그려 모든 부재를
 * 최소 2·PLAN_FILL_PX 두께의 단색으로 만든다. 멀리서는 트러스가 막대로
 * 읽히고 가까이서는 격자가 그대로 보인다(부풀림이 화면 px 상수라서).
 *
 * 머티리얼은 메쉬가 지금 쓰는 머티리얼의 clone 이다 — 알베도·텍스처가 같아
 * 장비 색이 그대로다(고정 주황을 쓰면 선체·블록이 주황 띠를 두른다). clone 은
 * shader-patch 등록이 따라오지 않으므로 평면도 톤·잠김 안개를 다시 걸고
 * 부풀림 패치를 더한다. 실루엣 윤곽과 같은 스텐실(발자국 밖에서만)·깊이 끔
 * 이고, 윤곽 헐보다 **뒤**에 그려 바깥 PLAN_VIEW_OUTLINE_PX 만 어두운 선으로
 * 남는다(윤곽은 채움 두께만큼 더 부풀린다 — ui/gltf-model.tsx).
 */

/** 채움 두께(화면 px, 한쪽). */
export const PLAN_FILL_PX = 1;
/** 평면도 윤곽 헐(10.4) 바로 뒤 — transparent 리스트. */
export const PLAN_FILL_RENDER_ORDER = 10.41;

const PATCH_KEY = 'plan-fill';

export interface PlanFillUniforms {
  /** 두께px × (2·tan(fov/2) / 뷰포트 높이px) — silhouette-outline 과 같은 계수. */
  uPlanFillOffset: IUniform<number>;
}

/** 전역 유니폼 — 캔버스가 자기 뷰포트 기준으로 쓴다(ui/object-plan-fill.tsx). */
export const planFillUniforms: PlanFillUniforms = {
  uPlanFillOffset: { value: 0 },
};

export function publishPlanFillOffset(value: number): boolean {
  const next = Number.isFinite(value) && value > 0 ? value : 0;
  if (planFillUniforms.uPlanFillOffset.value === next) return false;
  planFillUniforms.uPlanFillOffset.value = next;
  return true;
}

/**
 * project_vertex 를 뷰 공간 부풀림 판으로 바꾼다. 노멀은 normalMatrix 를
 * 거친 뷰 공간 단위 벡터라 노드 scale(meshopt 양자화 36×)과 무관하고, 깊이에
 * 비례해 밀어 화면 두께가 상수다. objectNormal 은 beginnormal_vertex 가 만든다.
 */
const PROJECT_VERTEX_INFLATED = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
mvPosition.xyz += normalize( normalMatrix * objectNormal ) * ( uPlanFillOffset * max( -mvPosition.z, 0.0 ) );
gl_Position = projectionMatrix * mvPosition;
`;

/**
 * 메쉬가 지금 쓰는 머티리얼에서 채움 머티리얼을 만든다. 호출자가 dispose.
 */
export function createPlanFillMaterial(source: Material): Material {
  const material = source.clone();
  material.name = `${source.name || 'material'} (plan-fill)`;
  material.side = DoubleSide;
  material.transparent = true;
  material.depthTest = false;
  material.depthWrite = false;
  material.stencilWrite = true;
  material.stencilWriteMask = 0;
  material.stencilRef = SILHOUETTE_STENCIL_BIT;
  material.stencilFunc = NotEqualStencilFunc;
  material.stencilFuncMask = SILHOUETTE_STENCIL_BIT;
  if (hasShaderPatch(source, 'sea-submersion')) applySeaSubmersion(material);
  applyPlanViewPatch(material, 'equipment');
  setShaderPatch(material, PATCH_KEY, (shader) => {
    shader.uniforms.uPlanFillOffset = planFillUniforms.uPlanFillOffset;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nuniform float uPlanFillOffset;',
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      PROJECT_VERTEX_INFLATED,
    );
  });
  return material;
}

/** 패치 키 — 테스트·진단용. */
export const PLAN_FILL_PATCH_KEY = PATCH_KEY;

/**
 * 대상 메쉬에 자식으로 붙일 채움 메쉬. geometry 는 실루엣 헐 캐시(스무딩
 * 노멀 — 평면 노멀로는 실루엣이 커지지 않는다, silhouette-outline.ts)를
 * 공유한다. raycast·그림자는 끊는다.
 */
export function createPlanFillMesh(target: Mesh, material: Material): Mesh {
  const mesh = new Mesh(
    warmSilhouetteOutlineGeometry(target.geometry),
    material,
  );
  mesh.raycast = () => {};
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = PLAN_FILL_RENDER_ORDER;
  mesh.name = 'plan-fill';
  return mesh;
}
