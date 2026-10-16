import { beforeEach, describe, expect, it } from 'vitest';
import { MeshLambertMaterial, MeshStandardMaterial } from 'three';
import {
  applyPlanViewPatch,
  clearPlanViewPatch,
  planViewPatchKey,
} from '../plan-view-patch';
import { planViewUniforms, publishPlanView } from '../plan-view-uniforms';
import { applySeaSubmersion } from '../sea-submersion';
import type { ShaderPatchTarget } from '../shader-patch';

function makeShader(): ShaderPatchTarget {
  return {
    uniforms: {},
    vertexShader: '#include <common>\n#include <worldpos_vertex>\n',
    fragmentShader:
      '#include <common>\n#include <color_fragment>\n#include <opaque_fragment>\n#include <tonemapping_fragment>\n',
  };
}

function run(
  material: MeshStandardMaterial | MeshLambertMaterial,
  shader: ShaderPatchTarget,
) {
  material.onBeforeCompile(
    shader as Parameters<typeof material.onBeforeCompile>[0],
    null as unknown as Parameters<typeof material.onBeforeCompile>[1],
  );
}

describe('plan-view-patch', () => {
  beforeEach(() => {
    publishPlanView(0);
  });

  it("'ground' 는 color_fragment 뒤에 톤 식을 넣고 전역 유니폼 객체를 물린다", () => {
    const m = new MeshLambertMaterial();
    applyPlanViewPatch(m, 'ground');
    const shader = makeShader();
    run(m, shader);
    expect(shader.fragmentShader).toContain('uniform float uPlanView;');
    expect(shader.fragmentShader).toContain('planTone');
    expect(shader.fragmentShader).not.toContain('planFlat');
    expect(shader.uniforms.uPlanView).toBe(planViewUniforms.uPlanView);
    expect(shader.fragmentShader).not.toContain('uPlanNight');
    expect(m.customProgramCacheKey()).toBe(planViewPatchKey('ground'));
  });

  it("'equipment' 는 opaque_fragment 앞에 평면 색 식을 넣는다", () => {
    const m = new MeshStandardMaterial();
    applyPlanViewPatch(m, 'equipment');
    const shader = makeShader();
    run(m, shader);
    expect(shader.fragmentShader).toContain('planFlat');
    expect(shader.fragmentShader).not.toContain('planTone');
    // 주입이 opaque_fragment 보다 앞에 있다.
    expect(shader.fragmentShader.indexOf('planFlat')).toBeLessThan(
      shader.fragmentShader.indexOf('#include <opaque_fragment>'),
    );
    expect(m.customProgramCacheKey()).toBe(planViewPatchKey('equipment'));
  });

  it('종류를 바꾸면 이전 종류는 빠진다 — 키가 하나만 남는다', () => {
    const m = new MeshStandardMaterial();
    applyPlanViewPatch(m, 'ground');
    applyPlanViewPatch(m, 'equipment');
    expect(m.customProgramCacheKey()).toBe(planViewPatchKey('equipment'));
    const shader = makeShader();
    run(m, shader);
    expect(shader.fragmentShader).not.toContain('planTone');
  });

  it('같은 종류 재적용은 멱등이다(version 그대로)', () => {
    const m = new MeshStandardMaterial();
    applyPlanViewPatch(m, 'ground');
    const version = m.version;
    applyPlanViewPatch(m, 'ground');
    expect(m.version).toBe(version);
  });

  it('잠김 안개 패치와 같은 머티리얼에 함께 걸린다 — 둘 다 주입되고 키가 이어진다', () => {
    const m = new MeshStandardMaterial();
    applySeaSubmersion(m);
    applyPlanViewPatch(m, 'equipment');
    const shader = makeShader();
    run(m, shader);
    expect(shader.fragmentShader).toContain('seaReachMask');
    expect(shader.fragmentShader).toContain('planFlat');
    expect(m.customProgramCacheKey()).toBe(
      `sea-submersion|${planViewPatchKey('equipment')}`,
    );
  });

  it('평면도 패치를 지워도 잠김 안개는 남는다', () => {
    const m = new MeshStandardMaterial();
    applySeaSubmersion(m);
    applyPlanViewPatch(m, 'ground');
    clearPlanViewPatch(m);
    expect(m.customProgramCacheKey()).toBe('sea-submersion');
  });

  it('패치 없는 머티리얼의 clear 는 no-op', () => {
    const m = new MeshStandardMaterial();
    const version = m.version;
    clearPlanViewPatch(m);
    expect(m.version).toBe(version);
  });
});

describe('plan-view-uniforms', () => {
  beforeEach(() => {
    publishPlanView(0);
  });

  it('값이 바뀔 때만 true 를 돌려주고, 같은 값은 쓰지 않는다', () => {
    expect(publishPlanView(1)).toBe(true);
    expect(planViewUniforms.uPlanView.value).toBe(1);
    expect(publishPlanView(1)).toBe(false);
  });

  it('범위를 [0,1] 로 자르고 비유한 값은 0 이다', () => {
    publishPlanView(3);
    expect(planViewUniforms.uPlanView.value).toBe(1);
    publishPlanView(-1);
    expect(planViewUniforms.uPlanView.value).toBe(0);
    publishPlanView(1);
    publishPlanView(Number.NaN);
    expect(planViewUniforms.uPlanView.value).toBe(0);
    publishPlanView(Number.POSITIVE_INFINITY);
    expect(planViewUniforms.uPlanView.value).toBe(0);
  });
});
