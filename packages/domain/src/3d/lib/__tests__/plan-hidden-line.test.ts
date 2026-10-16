import { describe, expect, it } from 'vitest';
import {
  AlwaysStencilFunc,
  BoxGeometry,
  DoubleSide,
  EqualStencilFunc,
  GreaterDepth,
  LessEqualDepth,
  Mesh,
  MeshStandardMaterial,
  NotEqualStencilFunc,
  ReplaceStencilOp,
} from 'three';
import {
  PLAN_HIDDEN_DEPTH_BIAS,
  PLAN_HIDDEN_PASS,
  PLAN_HIDDEN_PASS_COUNT,
  PLAN_HIDDEN_RENDER_ORDER,
  createPlanHiddenFillQuad,
  createPlanHiddenLineMeshes,
  createPlanHiddenOutlineMaterial,
  planHiddenLineMaterials,
  planHiddenLineRenderOrder,
} from '../plan-hidden-line';
import {
  PLAN_HIDDEN_REGION_STENCIL_BIT,
  PLAN_HIDDEN_STENCIL_BIT,
  SCENE_OPAQUE_STENCIL_BIT,
  SILHOUETTE_STENCIL_BIT,
} from '../scene-stencil';
import { PLAN_VIEW_OUTLINE_RENDER_ORDER } from '../status-outline-style';

const V = PLAN_HIDDEN_STENCIL_BIT;
const H = PLAN_HIDDEN_REGION_STENCIL_BIT;

function opacityOf(material: { uniforms: Record<string, { value: unknown }> }) {
  return material.uniforms.uOpacity.value as number;
}

describe('planHiddenLineRenderOrder', () => {
  it('같은 모델의 다섯 패스가 연속하고 다음 모델은 그 뒤다', () => {
    const passes = Array.from({ length: PLAN_HIDDEN_PASS_COUNT }, (_, p) => p);
    const m0 = passes.map((p) => planHiddenLineRenderOrder(0, p));
    const m1 = passes.map((p) => planHiddenLineRenderOrder(1, p));
    for (let i = 1; i < m0.length; i += 1) {
      expect(m0[i - 1]).toBeLessThan(m0[i]);
    }
    expect(m0[m0.length - 1]).toBeLessThan(m1[0]);
    expect(m0[0]).toBe(PLAN_HIDDEN_RENDER_ORDER);
    expect(Object.values(PLAN_HIDDEN_PASS).sort()).toEqual(passes);
  });

  it('불투명 패스(0) 뒤, 평면도 윤곽 헐 앞 — 모델 100개까지', () => {
    expect(PLAN_HIDDEN_RENDER_ORDER).toBeGreaterThan(0);
    expect(
      planHiddenLineRenderOrder(100, PLAN_HIDDEN_PASS_COUNT - 1),
    ).toBeLessThan(PLAN_VIEW_OUTLINE_RENDER_ORDER);
  });
});

describe('plan-hidden-line 머티리얼', () => {
  const [markVisible, markHidden, fill, clear] = planHiddenLineMaterials();
  const outline = createPlanHiddenOutlineMaterial();

  it('스텐실 비트가 서로·다른 용도와 겹치지 않는다', () => {
    const bits = [V, H, SILHOUETTE_STENCIL_BIT, SCENE_OPAQUE_STENCIL_BIT];
    for (let i = 0; i < bits.length; i += 1) {
      for (let j = i + 1; j < bits.length; j += 1) {
        expect(bits[i] & bits[j]).toBe(0);
      }
    }
  });

  it('깊이를 비교하는 패스는 본체와 같은 투영 청크·로그 깊이 청크를 쓰고 카메라 쪽 바이어스를 둔다', () => {
    for (const m of [markVisible, markHidden]) {
      expect(m.vertexShader).toContain('#include <begin_vertex>');
      expect(m.vertexShader).toContain('#include <project_vertex>');
      expect(m.vertexShader).not.toContain(
        'projectionMatrix * modelViewMatrix',
      );
    }
    for (const m of [markVisible, markHidden, outline]) {
      expect(m.vertexShader).toContain('#include <logdepthbuf_vertex>');
      expect(m.fragmentShader).toContain('#include <logdepthbuf_fragment>');
      expect(m.fragmentShader).toContain(
        `gl_FragDepth -= ${PLAN_HIDDEN_DEPTH_BIAS.toExponential()}`,
      );
    }
    expect(PLAN_HIDDEN_DEPTH_BIAS).toBeGreaterThan(0);
    expect(PLAN_HIDDEN_DEPTH_BIAS).toBeLessThan(1e-4);
  });

  it('1 보임 표식: 양면, 색 없이 깊이 통과(LessEqual) 픽셀에 V 를 찍는다', () => {
    expect(markVisible.side).toBe(DoubleSide);
    expect(markVisible.colorWrite).toBe(false);
    expect(markVisible.depthTest).toBe(true);
    expect(markVisible.depthFunc).toBe(LessEqualDepth);
    expect(markVisible.depthWrite).toBe(false);
    expect(markVisible.stencilWrite).toBe(true);
    expect(markVisible.stencilFunc).toBe(AlwaysStencilFunc);
    expect(markVisible.stencilRef).toBe(V);
    expect(markVisible.stencilWriteMask).toBe(V);
    expect(markVisible.stencilZPass).toBe(ReplaceStencilOp);
  });

  it('2 가려짐 표식: 양면, 더 뒤(GreaterDepth)이면서 V 가 없는 픽셀에 H 를 찍는다', () => {
    expect(markHidden.side).toBe(DoubleSide);
    expect(markHidden.colorWrite).toBe(false);
    expect(markHidden.depthTest).toBe(true);
    expect(markHidden.depthFunc).toBe(GreaterDepth);
    expect(markHidden.depthWrite).toBe(false);
    expect(markHidden.stencilFunc).toBe(NotEqualStencilFunc);
    expect(markHidden.stencilFuncMask).toBe(V);
    expect(markHidden.stencilRef & V).toBe(V);
    expect(markHidden.stencilWriteMask).toBe(H);
    expect(markHidden.stencilRef & H).toBe(H);
    expect(markHidden.stencilZPass).toBe(ReplaceStencilOp);
  });

  it('3 채움: 깊이 무관, H 픽셀에만 무늬 없는 반투명 단색을 출력 색공간으로 내보낸다', () => {
    expect(fill.transparent).toBe(true);
    expect(fill.depthTest).toBe(false);
    expect(fill.depthWrite).toBe(false);
    expect(fill.stencilFunc).toBe(EqualStencilFunc);
    expect(fill.stencilRef).toBe(H);
    expect(fill.stencilFuncMask).toBe(H);
    expect(fill.stencilWriteMask).toBe(0);
    expect(fill.vertexShader).toContain(
      'gl_Position = vec4(position.xy, 0.0, 1.0)',
    );
    expect(fill.fragmentShader).not.toContain('discard');
    expect(fill.fragmentShader).toContain('#include <colorspace_fragment>');
    expect(opacityOf(fill)).toBeGreaterThan(0);
    expect(opacityOf(fill)).toBeLessThan(1);
  });

  it('4 윤곽: 양면 헐, 더 뒤(GreaterDepth)이면서 V·H 둘 다 없는 픽셀만, 비트는 안 쓴다', () => {
    expect(outline.side).toBe(DoubleSide);
    expect(outline.transparent).toBe(true);
    expect(outline.depthTest).toBe(true);
    expect(outline.depthFunc).toBe(GreaterDepth);
    expect(outline.depthWrite).toBe(false);
    expect(outline.stencilFunc).toBe(EqualStencilFunc);
    expect(outline.stencilRef).toBe(0);
    expect(outline.stencilFuncMask).toBe(V | H);
    expect(outline.stencilWriteMask).toBe(0);
    expect(outline.uniforms.uOffsetFactor.value).toBe(0);
    expect(outline.vertexShader).toContain('uOffsetFactor');
    expect(outline.fragmentShader).toContain('#include <colorspace_fragment>');
    expect(opacityOf(outline)).toBeGreaterThan(0);
    expect(opacityOf(outline)).toBeLessThanOrEqual(1);
  });

  it('윤곽 머티리얼은 호출마다 새것 — 캔버스별 두께 유니폼이 섞이지 않는다', () => {
    const other = createPlanHiddenOutlineMaterial();
    expect(other).not.toBe(outline);
    expect(other.uniforms.uOffsetFactor).not.toBe(
      outline.uniforms.uOffsetFactor,
    );
  });

  it('5 지우기: 양면, 깊이 무관하게 V·H 를 0 으로', () => {
    expect(clear.side).toBe(DoubleSide);
    expect(clear.colorWrite).toBe(false);
    expect(clear.depthTest).toBe(false);
    expect(clear.stencilRef).toBe(0);
    expect(clear.stencilFuncMask).toBe(V | H);
    expect(clear.stencilWriteMask).toBe(V | H);
    expect(clear.stencilFail).toBe(ReplaceStencilOp);
    expect(clear.stencilZFail).toBe(ReplaceStencilOp);
    expect(clear.stencilZPass).toBe(ReplaceStencilOp);
  });
});

describe('createPlanHiddenLineMeshes', () => {
  it('메쉬 패스 넷 — 표식·지우기는 대상 geometry 공유, 윤곽은 스무딩 헐, 순서·raycast 차단·그림자 없음', () => {
    const target = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    target.frustumCulled = false;
    const outlineMaterial = createPlanHiddenOutlineMaterial();
    const passes = createPlanHiddenLineMeshes(target, 2, outlineMaterial);
    expect(passes).toHaveLength(4);
    const [markVisible, markHidden, outline, clear] = passes;
    const [mv, mh, , cl] = planHiddenLineMaterials();
    expect(markVisible.material).toBe(mv);
    expect(markHidden.material).toBe(mh);
    expect(outline.material).toBe(outlineMaterial);
    expect(clear.material).toBe(cl);
    for (const pass of [markVisible, markHidden, clear]) {
      expect(pass.geometry).toBe(target.geometry);
    }
    expect(outline.geometry).not.toBe(target.geometry);
    expect(outline.geometry.getAttribute('normal')).toBeDefined();
    expect(passes.map((p) => p.renderOrder)).toEqual(
      [
        PLAN_HIDDEN_PASS.markVisible,
        PLAN_HIDDEN_PASS.markHidden,
        PLAN_HIDDEN_PASS.outline,
        PLAN_HIDDEN_PASS.clear,
      ].map((p) => planHiddenLineRenderOrder(2, p)),
    );
    for (const pass of passes) {
      expect(pass.castShadow).toBe(false);
      expect(pass.receiveShadow).toBe(false);
      expect(pass.frustumCulled).toBe(false);
      expect(pass.raycast(null as never, [])).toBeUndefined();
    }
  });

  it('같은 geometry 의 두 대상은 같은 스무딩 헐을 쓴다(캐시)', () => {
    const geometry = new BoxGeometry();
    const a = new Mesh(geometry, new MeshStandardMaterial());
    const b = new Mesh(geometry, new MeshStandardMaterial());
    const outlineMaterial = createPlanHiddenOutlineMaterial();
    const [, , hullA] = createPlanHiddenLineMeshes(a, 0, outlineMaterial);
    const [, , hullB] = createPlanHiddenLineMeshes(b, 1, outlineMaterial);
    expect(hullA.geometry).toBe(hullB.geometry);
  });
});

describe('createPlanHiddenFillQuad', () => {
  it('채움 쿼드 — 절두체 컬링 없음, 채움 자리, 공유 머티리얼, raycast 차단', () => {
    const quad = createPlanHiddenFillQuad(2);
    expect(quad.frustumCulled).toBe(false);
    expect(quad.renderOrder).toBe(
      planHiddenLineRenderOrder(2, PLAN_HIDDEN_PASS.fill),
    );
    expect(quad.material).toBe(planHiddenLineMaterials()[2]);
    expect(quad.castShadow).toBe(false);
    expect(quad.raycast(null as never, [])).toBeUndefined();
  });

  it('쿼드끼리 geometry 를 공유한다 — dispose 대상이 아니다', () => {
    expect(createPlanHiddenFillQuad(0).geometry).toBe(
      createPlanHiddenFillQuad(1).geometry,
    );
  });
});
