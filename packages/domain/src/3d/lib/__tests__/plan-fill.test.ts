import { beforeEach, describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  NotEqualStencilFunc,
} from 'three';
import {
  PLAN_FILL_PATCH_KEY,
  PLAN_FILL_RENDER_ORDER,
  createPlanFillMaterial,
  createPlanFillMesh,
  planFillUniforms,
  publishPlanFillOffset,
} from '../plan-fill';
import { planViewPatchKey } from '../plan-view-patch';
import { SILHOUETTE_STENCIL_BIT } from '../scene-stencil';
import { applySeaSubmersion } from '../sea-submersion';
import { hasShaderPatch, type ShaderPatchTarget } from '../shader-patch';
import { SILHOUETTE_OUTLINE_RENDER_ORDER } from '../silhouette-outline';
import { PLAN_VIEW_OUTLINE_RENDER_ORDER } from '../status-outline-style';

function makeShader(): ShaderPatchTarget {
  return {
    uniforms: {},
    vertexShader:
      '#include <common>\n#include <beginnormal_vertex>\n#include <worldpos_vertex>\n#include <project_vertex>\n',
    fragmentShader:
      '#include <common>\n#include <color_fragment>\n#include <opaque_fragment>\n#include <tonemapping_fragment>\n',
  };
}

function run(material: MeshStandardMaterial, shader: ShaderPatchTarget) {
  material.onBeforeCompile(
    shader as Parameters<typeof material.onBeforeCompile>[0],
    null as unknown as Parameters<typeof material.onBeforeCompile>[1],
  );
}

describe('createPlanFillMaterial', () => {
  it('원본 색·이름을 물려받은 clone 에 스텐실(발자국 밖)·깊이 끔·양면·transparent', () => {
    const source = new MeshStandardMaterial({
      color: '#f08a24',
      name: 'orange',
    });
    const m = createPlanFillMaterial(source) as MeshStandardMaterial;
    expect(m).not.toBe(source);
    expect(m.color.getHexString()).toBe(source.color.getHexString());
    expect(m.name).toContain('orange');
    expect(m.side).toBe(DoubleSide);
    expect(m.transparent).toBe(true);
    expect(m.depthTest).toBe(false);
    expect(m.depthWrite).toBe(false);
    expect(m.stencilWrite).toBe(true);
    expect(m.stencilWriteMask).toBe(0);
    expect(m.stencilFunc).toBe(NotEqualStencilFunc);
    expect(m.stencilRef).toBe(SILHOUETTE_STENCIL_BIT);
    expect(m.stencilFuncMask).toBe(SILHOUETTE_STENCIL_BIT);
  });

  it('평면도 톤 + 부풀림 패치가 걸리고, project_vertex 가 교체된다', () => {
    const m = createPlanFillMaterial(
      new MeshStandardMaterial(),
    ) as MeshStandardMaterial;
    expect(hasShaderPatch(m, PLAN_FILL_PATCH_KEY)).toBe(true);
    expect(m.customProgramCacheKey()).toBe(
      `${planViewPatchKey('equipment')}|${PLAN_FILL_PATCH_KEY}`,
    );
    const shader = makeShader();
    run(m, shader);
    expect(shader.vertexShader).not.toContain('#include <project_vertex>');
    expect(shader.vertexShader).toContain('uPlanFillOffset');
    expect(shader.vertexShader).toContain('normalMatrix * objectNormal');
    expect(shader.uniforms.uPlanFillOffset).toBe(
      planFillUniforms.uPlanFillOffset,
    );
    expect(shader.fragmentShader).toContain('planFlat');
  });

  it('원본에 잠김 안개가 있으면 따라온다(clone 은 패치를 복사하지 않는다)', () => {
    const source = new MeshStandardMaterial();
    applySeaSubmersion(source);
    const plain = createPlanFillMaterial(new MeshStandardMaterial());
    const fogged = createPlanFillMaterial(source);
    expect(hasShaderPatch(plain, 'sea-submersion')).toBe(false);
    expect(hasShaderPatch(fogged, 'sea-submersion')).toBe(true);
    expect(fogged.customProgramCacheKey().startsWith('sea-submersion|')).toBe(
      true,
    );
  });

  it('원본은 건드리지 않는다', () => {
    const source = new MeshStandardMaterial();
    createPlanFillMaterial(source);
    expect(source.depthTest).toBe(true);
    expect(source.stencilWrite).toBe(false);
    expect(hasShaderPatch(source, PLAN_FILL_PATCH_KEY)).toBe(false);
  });
});

describe('createPlanFillMesh', () => {
  it('헐 캐시 geometry 를 쓰고 윤곽 헐 뒤·선택 테두리 앞 순서다', () => {
    const target = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const fill = createPlanFillMesh(
      target,
      createPlanFillMaterial(target.material),
    );
    expect(fill.geometry).not.toBe(target.geometry);
    expect(fill.geometry.getAttribute('normal')).toBeDefined();
    expect(fill.renderOrder).toBe(PLAN_FILL_RENDER_ORDER);
    expect(PLAN_FILL_RENDER_ORDER).toBeGreaterThan(
      PLAN_VIEW_OUTLINE_RENDER_ORDER,
    );
    expect(PLAN_FILL_RENDER_ORDER).toBeLessThan(
      SILHOUETTE_OUTLINE_RENDER_ORDER,
    );
    expect(fill.castShadow).toBe(false);
    expect(fill.raycast(null as never, [])).toBeUndefined();
  });
});

describe('publishPlanFillOffset', () => {
  beforeEach(() => {
    publishPlanFillOffset(0);
  });
  it('바뀔 때만 true, 비유한수·음수는 0', () => {
    expect(publishPlanFillOffset(0.002)).toBe(true);
    expect(publishPlanFillOffset(0.002)).toBe(false);
    publishPlanFillOffset(Number.NaN);
    expect(planFillUniforms.uPlanFillOffset.value).toBe(0);
    publishPlanFillOffset(-1);
    expect(planFillUniforms.uPlanFillOffset.value).toBe(0);
  });
});
