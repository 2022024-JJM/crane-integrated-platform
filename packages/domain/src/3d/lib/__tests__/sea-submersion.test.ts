import { describe, expect, it } from 'vitest';
import { MeshLambertMaterial, MeshStandardMaterial, ShaderLib } from 'three';
import { seaReachUniforms } from '../sea-reach-uniforms';
import {
  SEA_FOG_DENSITY,
  SEA_FOG_MAX,
  SEA_REACH_EDGE,
  applySeaSubmersion,
  clearSeaSubmersion,
} from '../sea-submersion';

/** three가 onBeforeCompile에 넘겨주는 shader 객체의 최소 형태 */
function fakeShader() {
  return {
    uniforms: {} as Record<string, unknown>,
    vertexShader: [
      '#include <common>',
      '#include <worldpos_vertex>',
      'void main() {}',
    ].join('\n'),
    fragmentShader: [
      '#include <common>',
      '#include <tonemapping_fragment>',
      'void main() {}',
    ].join('\n'),
  };
}

describe('applySeaSubmersion', () => {
  it('vertex/fragment 셰이더에 vSeaWorldPos varying과 깊이 안개를 주입한다', () => {
    const material = new MeshStandardMaterial();
    applySeaSubmersion(material);

    const shader = fakeShader();
    material.onBeforeCompile(
      shader as Parameters<typeof material.onBeforeCompile>[0],
      null as unknown as Parameters<typeof material.onBeforeCompile>[1],
    );

    expect(shader.vertexShader).toContain('varying vec3 vSeaWorldPos;');
    expect(shader.vertexShader).toContain('#include <worldpos_vertex>');
    expect(shader.vertexShader).toContain('modelMatrix');

    expect(shader.fragmentShader).toContain('varying vec3 vSeaWorldPos;');
    // 상수는 GLSL 리터럴로 구워진다 — uniform이 아니다.
    expect(shader.fragmentShader).toContain(SEA_FOG_DENSITY.toFixed(4));
    expect(shader.fragmentShader).toContain(SEA_FOG_MAX.toFixed(4));
    // 톤매핑 앞(linear)에서 섞는다 — include는 주입 코드 뒤에 그대로 남는다.
    expect(shader.fragmentShader).toContain('#include <tonemapping_fragment>');
    expect(shader.fragmentShader.indexOf('seaFog')).toBeLessThan(
      shader.fragmentShader.indexOf('#include <tonemapping_fragment>'),
    );
  });

  // 지도는 PBR(ground)·Lambert(context 지형) 두 셰이더로 그려진다 — 주입
  // 지점 include 가 three 의 실제 셰이더에서 빠지면 replace 가 조용히 no-op
  // 이 되어 안개만 사라진다.
  it.each([
    ['standard', new MeshStandardMaterial()],
    ['lambert', new MeshLambertMaterial()],
  ] as const)('three 의 실제 %s 셰이더에 주입된다', (key, material) => {
    applySeaSubmersion(material);

    const shader = {
      uniforms: {},
      vertexShader: ShaderLib[key].vertexShader,
      fragmentShader: ShaderLib[key].fragmentShader,
    };
    material.onBeforeCompile(
      shader as Parameters<typeof material.onBeforeCompile>[0],
      null as unknown as Parameters<typeof material.onBeforeCompile>[1],
    );

    expect(shader.vertexShader).toContain('varying vec3 vSeaWorldPos;');
    expect(shader.vertexShader).toContain('vSeaWorldPos = ');
    expect(shader.fragmentShader).toContain('varying vec3 vSeaWorldPos;');
    expect(shader.fragmentShader).toContain('uniform sampler2D seaReachMask;');
    expect(shader.fragmentShader).toContain('seaFog');
    // 선언은 한 번씩만 — 두 번 들어가면 셰이더 컴파일이 깨진다.
    expect(
      shader.fragmentShader.split('uniform mat3 seaReachTransform;'),
    ).toHaveLength(2);
    expect(
      shader.vertexShader.split('varying vec3 vSeaWorldPos;'),
    ).toHaveLength(2);
  });

  it('바다 도달 마스크로 안개를 거른다 — 전역 유니폼 객체를 그대로 물린다', () => {
    const first = new MeshStandardMaterial();
    const second = new MeshLambertMaterial();
    applySeaSubmersion(first);
    applySeaSubmersion(second);

    const shaders = [first, second].map((material) => {
      const shader = fakeShader();
      material.onBeforeCompile(
        shader as Parameters<typeof material.onBeforeCompile>[0],
        null as unknown as Parameters<typeof material.onBeforeCompile>[1],
      );
      return shader;
    });

    for (const shader of shaders) {
      // 값 복사가 아니라 같은 객체 — 마스크를 갈면 전 머티리얼이 함께 바뀐다.
      expect(shader.uniforms.seaReachMask).toBe(seaReachUniforms.seaReachMask);
      expect(shader.uniforms.seaReachTransform).toBe(
        seaReachUniforms.seaReachTransform,
      );
      expect(shader.fragmentShader).toContain('texture2D(seaReachMask, seaUv)');
      expect(shader.fragmentShader).toContain(
        SEA_REACH_EDGE.map((v) => v.toFixed(4)).join(', '),
      );
      expect(shader.fragmentShader).toMatch(/seaFog = [^;]*\* seaReach;/);
    }
  });

  it('이미 있던 유니폼은 건드리지 않는다', () => {
    const material = new MeshStandardMaterial();
    applySeaSubmersion(material);
    const diffuse = { value: 1 };
    const shader = { ...fakeShader(), uniforms: { diffuse } };
    material.onBeforeCompile(
      shader as unknown as Parameters<typeof material.onBeforeCompile>[0],
      null as unknown as Parameters<typeof material.onBeforeCompile>[1],
    );
    expect(shader.uniforms.diffuse).toBe(diffuse);
  });

  it('customProgramCacheKey를 반드시 지정한다 — 없으면 원본 프로그램이 재사용된다', () => {
    const material = new MeshStandardMaterial();
    applySeaSubmersion(material);
    expect(material.customProgramCacheKey()).toBe('sea-submersion');
  });

  it('needsUpdate를 올린다 (version 증가)', () => {
    const material = new MeshStandardMaterial();
    const before = material.version;
    applySeaSubmersion(material);
    expect(material.version).toBe(before + 1);
  });
});

describe('clearSeaSubmersion', () => {
  it('패치된 머티리얼의 주입을 해제한다', () => {
    const material = new MeshStandardMaterial();
    applySeaSubmersion(material);
    clearSeaSubmersion(material);

    expect(material.customProgramCacheKey()).toBe('');

    const shader = fakeShader();
    const originalVertex = shader.vertexShader;
    material.onBeforeCompile(
      shader as Parameters<typeof material.onBeforeCompile>[0],
      null as unknown as Parameters<typeof material.onBeforeCompile>[1],
    );
    expect(shader.vertexShader).toBe(originalVertex);
  });

  it('패치되지 않은 머티리얼은 건드리지 않는다', () => {
    const material = new MeshStandardMaterial();
    const before = material.version;
    clearSeaSubmersion(material);
    expect(material.version).toBe(before);
  });
});
