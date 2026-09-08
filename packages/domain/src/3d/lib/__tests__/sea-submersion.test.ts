import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial } from 'three';
import {
  SEA_FOG_DENSITY,
  SEA_FOG_MAX,
  applySeaSubmersion,
  clearSeaSubmersion,
} from '../sea-submersion';

/** three가 onBeforeCompile에 넘겨주는 shader 객체의 최소 형태 */
function fakeShader() {
  return {
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
  it('vertex/fragment 셰이더에 vSeaWorldY varying과 깊이 안개를 주입한다', () => {
    const material = new MeshStandardMaterial();
    applySeaSubmersion(material);

    const shader = fakeShader();
    material.onBeforeCompile(
      shader as Parameters<typeof material.onBeforeCompile>[0],
      null as unknown as Parameters<typeof material.onBeforeCompile>[1],
    );

    expect(shader.vertexShader).toContain('varying float vSeaWorldY;');
    expect(shader.vertexShader).toContain('#include <worldpos_vertex>');
    expect(shader.vertexShader).toContain('modelMatrix');

    expect(shader.fragmentShader).toContain('varying float vSeaWorldY;');
    // 상수는 GLSL 리터럴로 구워진다 — uniform이 아니다.
    expect(shader.fragmentShader).toContain(SEA_FOG_DENSITY.toFixed(4));
    expect(shader.fragmentShader).toContain(SEA_FOG_MAX.toFixed(4));
    // 톤매핑 앞(linear)에서 섞는다 — include는 주입 코드 뒤에 그대로 남는다.
    expect(shader.fragmentShader).toContain('#include <tonemapping_fragment>');
    expect(
      shader.fragmentShader.indexOf('seaFog'),
    ).toBeLessThan(shader.fragmentShader.indexOf('#include <tonemapping_fragment>'));
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
