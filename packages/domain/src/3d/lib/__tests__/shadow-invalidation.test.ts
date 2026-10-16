import { beforeEach, describe, expect, it } from 'vitest';
import {
  invalidateShadows,
  registerShadowRenderer,
  setShadowsSuppressed,
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

  describe('setShadowsSuppressed (직교 탑뷰 보류)', () => {
    it('보류 중엔 무효화 신호를 삼킨다 — 다른 렌더러는 그대로 갱신된다', () => {
      const a = makeRenderer();
      const b = makeRenderer();
      register(a);
      register(b);
      setShadowsSuppressed(a, true);
      invalidateShadows();
      expect(a.shadowMap.needsUpdate).toBe(false);
      expect(b.shadowMap.needsUpdate).toBe(true);
    });

    it('해제하면 그 자리에서 한 번 갱신한다 — 보류 동안의 변화를 따라잡는다', () => {
      const gl = makeRenderer();
      register(gl);
      setShadowsSuppressed(gl, true);
      invalidateShadows();
      expect(gl.shadowMap.needsUpdate).toBe(false);
      setShadowsSuppressed(gl, false);
      expect(gl.shadowMap.needsUpdate).toBe(true);
    });

    it('멱등: 보류 재설정·보류 아닌 렌더러 해제는 needsUpdate 를 건드리지 않는다', () => {
      const gl = makeRenderer();
      register(gl);
      setShadowsSuppressed(gl, false);
      expect(gl.shadowMap.needsUpdate).toBe(false);
      setShadowsSuppressed(gl, true);
      setShadowsSuppressed(gl, true);
      expect(gl.shadowMap.needsUpdate).toBe(false);
    });

    it('미등록 렌더러는 무시한다(그림자 꺼진 씬)', () => {
      const gl = makeRenderer();
      expect(() => setShadowsSuppressed(gl, true)).not.toThrow();
      setShadowsSuppressed(gl, false);
      expect(gl.shadowMap.needsUpdate).toBe(false);
    });

    it('해제(unregister)된 렌더러의 보류는 지워진다 — 재등록 시 정상 갱신', () => {
      const gl = makeRenderer();
      register(gl);
      setShadowsSuppressed(gl, true);
      unregisterShadowRenderer(gl);
      register(gl);
      invalidateShadows();
      expect(gl.shadowMap.needsUpdate).toBe(true);
    });
  });
});
