import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial } from 'three';
import {
  clearShaderPatch,
  hasShaderPatch,
  setShaderPatch,
  type ShaderPatchTarget,
} from '../shader-patch';

function makeShader(): ShaderPatchTarget {
  return {
    uniforms: {},
    vertexShader: '#include <common>\nvoid main(){}',
    fragmentShader: '#include <common>\nvoid main(){}',
  };
}

function run(material: MeshStandardMaterial, shader: ShaderPatchTarget) {
  material.onBeforeCompile(
    shader as Parameters<typeof material.onBeforeCompile>[0],
    null as unknown as Parameters<typeof material.onBeforeCompile>[1],
  );
}

describe('shader-patch', () => {
  it('패치 하나: onBeforeCompile 이 그 패치를 돌리고 키가 customProgramCacheKey 가 된다', () => {
    const m = new MeshStandardMaterial();
    setShaderPatch(m, 'a', (s) => {
      s.fragmentShader = s.fragmentShader.replace('#include <common>', 'A');
    });
    const shader = makeShader();
    run(m, shader);
    expect(shader.fragmentShader.startsWith('A')).toBe(true);
    expect(m.customProgramCacheKey()).toBe('a');
    expect(hasShaderPatch(m, 'a')).toBe(true);
  });

  it('패치 둘: 등록 순서로 모두 적용되고 키가 이어진다', () => {
    const m = new MeshStandardMaterial();
    const order: string[] = [];
    setShaderPatch(m, 'a', () => {
      order.push('a');
    });
    setShaderPatch(m, 'b', () => {
      order.push('b');
    });
    run(m, makeShader());
    expect(order).toEqual(['a', 'b']);
    expect(m.customProgramCacheKey()).toBe('a|b');
  });

  it('같은 키 재등록은 교체다 — 두 번 돌지 않는다', () => {
    const m = new MeshStandardMaterial();
    let calls = 0;
    setShaderPatch(m, 'a', () => {
      calls += 1;
    });
    setShaderPatch(m, 'a', () => {
      calls += 10;
    });
    run(m, makeShader());
    expect(calls).toBe(10);
    expect(m.customProgramCacheKey()).toBe('a');
  });

  it('하나를 해제하면 나머지는 남고 키에서 빠진다', () => {
    const m = new MeshStandardMaterial();
    const order: string[] = [];
    setShaderPatch(m, 'a', () => {
      order.push('a');
    });
    setShaderPatch(m, 'b', () => {
      order.push('b');
    });
    clearShaderPatch(m, 'a');
    run(m, makeShader());
    expect(order).toEqual(['b']);
    expect(m.customProgramCacheKey()).toBe('b');
    expect(hasShaderPatch(m, 'a')).toBe(false);
  });

  it('전부 해제하면 빈 키 — 원본 프로그램으로 돌아간다', () => {
    const m = new MeshStandardMaterial();
    setShaderPatch(m, 'a', () => {});
    clearShaderPatch(m, 'a');
    expect(m.customProgramCacheKey()).toBe('');
    expect(() => run(m, makeShader())).not.toThrow();
  });

  it('없는 키 해제·패치 없는 머티리얼은 no-op 이고 version 도 그대로다', () => {
    const m = new MeshStandardMaterial();
    const version = m.version;
    clearShaderPatch(m, 'nope');
    expect(m.version).toBe(version);
    expect(hasShaderPatch(m, 'nope')).toBe(false);
  });

  it('등록·해제는 needsUpdate 를 올린다(version 증가)', () => {
    const m = new MeshStandardMaterial();
    const v0 = m.version;
    setShaderPatch(m, 'a', () => {});
    expect(m.version).toBeGreaterThan(v0);
    const v1 = m.version;
    clearShaderPatch(m, 'a');
    expect(m.version).toBeGreaterThan(v1);
  });
});
