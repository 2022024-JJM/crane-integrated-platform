import { describe, expect, it } from 'vitest';
import {
  AlwaysStencilFunc,
  BoxGeometry,
  GreaterDepth,
  Mesh,
  MeshStandardMaterial,
  NotEqualStencilFunc,
} from 'three';
import {
  PLAN_HIDDEN_RENDER_ORDER,
  createPlanHiddenLineMeshes,
  planHiddenLineMaterials,
  planHiddenLineRenderOrder,
} from '../plan-hidden-line';
import {
  PLAN_HIDDEN_STENCIL_BIT,
  SCENE_OPAQUE_STENCIL_BIT,
  SILHOUETTE_STENCIL_BIT,
} from '../scene-stencil';
import { PLAN_VIEW_OUTLINE_RENDER_ORDER } from '../status-outline-style';

describe('planHiddenLineRenderOrder', () => {
  it('같은 모델의 세 패스가 연속하고 다음 모델은 그 뒤다', () => {
    const m0 = [0, 1, 2].map((p) => planHiddenLineRenderOrder(0, p));
    const m1 = [0, 1, 2].map((p) => planHiddenLineRenderOrder(1, p));
    expect(m0[0]).toBeLessThan(m0[1]);
    expect(m0[1]).toBeLessThan(m0[2]);
    expect(m0[2]).toBeLessThan(m1[0]);
    expect(m0[0]).toBe(PLAN_HIDDEN_RENDER_ORDER);
  });

  it('불투명 패스(0) 뒤, 평면도 윤곽 마스크 앞 — 모델 100개까지', () => {
    expect(PLAN_HIDDEN_RENDER_ORDER).toBeGreaterThan(0);
    expect(planHiddenLineRenderOrder(100, 2)).toBeLessThan(
      PLAN_VIEW_OUTLINE_RENDER_ORDER,
    );
  });
});

describe('plan-hidden-line 머티리얼', () => {
  const [mark, hatch, clear] = planHiddenLineMaterials();

  it('스텐실 비트가 다른 용도와 겹치지 않는다', () => {
    expect(PLAN_HIDDEN_STENCIL_BIT & SILHOUETTE_STENCIL_BIT).toBe(0);
    expect(PLAN_HIDDEN_STENCIL_BIT & SCENE_OPAQUE_STENCIL_BIT).toBe(0);
  });

  it('1 가시 표식: 색 없이 깊이 통과 픽셀에 비트를 찍는다', () => {
    expect(mark.colorWrite).toBe(false);
    expect(mark.depthTest).toBe(true);
    expect(mark.depthWrite).toBe(false);
    expect(mark.stencilFunc).toBe(AlwaysStencilFunc);
    expect(mark.stencilWriteMask).toBe(PLAN_HIDDEN_STENCIL_BIT);
    expect(mark.stencilRef).toBe(PLAN_HIDDEN_STENCIL_BIT);
  });

  it('2 빗금: 더 뒤(GreaterDepth)이면서 비트가 없는 픽셀만, 비트는 안 쓴다', () => {
    expect(hatch.depthFunc).toBe(GreaterDepth);
    expect(hatch.depthWrite).toBe(false);
    expect(hatch.stencilFunc).toBe(NotEqualStencilFunc);
    expect(hatch.stencilRef).toBe(PLAN_HIDDEN_STENCIL_BIT);
    expect(hatch.stencilFuncMask).toBe(PLAN_HIDDEN_STENCIL_BIT);
    expect(hatch.stencilWriteMask).toBe(0);
    expect(hatch.fragmentShader).toContain('discard');
  });

  it('세 패스 모두 로그 깊이 청크로 깊이를 쓴다 — 메쉬 셰이더와 같은 경로', () => {
    for (const m of [mark, hatch, clear]) {
      expect(m.vertexShader).toContain('#include <logdepthbuf_vertex>');
      expect(m.fragmentShader).toContain('#include <logdepthbuf_fragment>');
    }
  });

  it('3 지우기: 깊이 무관하게 비트를 0 으로', () => {
    expect(clear.colorWrite).toBe(false);
    expect(clear.depthTest).toBe(false);
    expect(clear.stencilRef).toBe(0);
    expect(clear.stencilWriteMask).toBe(PLAN_HIDDEN_STENCIL_BIT);
  });
});

describe('createPlanHiddenLineMeshes', () => {
  it('대상 geometry 를 공유하는 세 메쉬 — 순서·raycast 차단·그림자 없음', () => {
    const target = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const passes = createPlanHiddenLineMeshes(target, 2);
    expect(passes).toHaveLength(3);
    passes.forEach((pass, i) => {
      expect(pass.geometry).toBe(target.geometry);
      expect(pass.renderOrder).toBe(planHiddenLineRenderOrder(2, i));
      expect(pass.castShadow).toBe(false);
      expect(pass.receiveShadow).toBe(false);
      expect(pass.raycast(null as never, [])).toBeUndefined();
    });
    expect(passes.map((p) => p.material)).toEqual([
      ...planHiddenLineMaterials(),
    ]);
  });
});
