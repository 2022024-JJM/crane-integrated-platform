import { beforeEach, describe, expect, it } from 'vitest';
import {
  invalidateShadows,
  registerShadowRenderer,
  unregisterShadowRenderer,
} from '../shadow-invalidation';

function makeRenderer() {
  return { shadowMap: { needsUpdate: false } };
}

describe('shadow-invalidation', () => {
  // 모듈 싱글턴이므로 각 테스트가 만든 렌더러는 각자 해제한다.
  const registered: ReturnType<typeof makeRenderer>[] = [];
  const register = (gl: ReturnType<typeof makeRenderer>) => {
    registerShadowRenderer(gl);
    registered.push(gl);
  };

  beforeEach(() => {
    for (const gl of registered.splice(0)) {
      unregisterShadowRenderer(gl);
    }
  });

  it('등록된 렌더러의 needsUpdate 를 세운다', () => {
    const gl = makeRenderer();
    register(gl);
    invalidateShadows();
    expect(gl.shadowMap.needsUpdate).toBe(true);
  });

  it('렌더러가 없으면 no-op — 호출부가 조건 없이 불러도 안전', () => {
    expect(() => invalidateShadows()).not.toThrow();
  });

  it('다중 캔버스: 등록된 전부가 갱신된다', () => {
    const a = makeRenderer();
    const b = makeRenderer();
    register(a);
    register(b);
    invalidateShadows();
    expect(a.shadowMap.needsUpdate).toBe(true);
    expect(b.shadowMap.needsUpdate).toBe(true);
  });

  it('해제된 렌더러는 더 이상 갱신되지 않는다', () => {
    const gl = makeRenderer();
    register(gl);
    unregisterShadowRenderer(gl);
    invalidateShadows();
    expect(gl.shadowMap.needsUpdate).toBe(false);
  });

  it('같은 렌더러 중복 등록은 1개로 취급된다(Set)', () => {
    const gl = makeRenderer();
    register(gl);
    register(gl);
    unregisterShadowRenderer(gl);
    invalidateShadows();
    expect(gl.shadowMap.needsUpdate).toBe(false);
  });

  it('없는 렌더러 해제는 no-op', () => {
    expect(() => unregisterShadowRenderer(makeRenderer())).not.toThrow();
  });
});
