import { describe, expect, it } from 'vitest';
import {
  AlwaysStencilFunc,
  KeepStencilOp,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NotEqualStencilFunc,
  ReplaceStencilOp,
} from 'three';
import {
  SCENE_OPAQUE_STENCIL_BIT,
  SILHOUETTE_STENCIL_BIT,
  hasSceneOpaqueStencil,
  markSceneOpaqueStencil,
  markSceneOpaqueStencils,
} from '../scene-stencil';

describe('scene-stencil', () => {
  it('두 용도의 비트가 겹치지 않는다 — 서로의 마스크가 상대 비트를 지우면 안 된다', () => {
    expect(SILHOUETTE_STENCIL_BIT & SCENE_OPAQUE_STENCIL_BIT).toBe(0);
    expect(SILHOUETTE_STENCIL_BIT).toBeGreaterThan(0);
    expect(SCENE_OPAQUE_STENCIL_BIT).toBeGreaterThan(0);
    // 8bit 스텐실 안.
    expect(SILHOUETTE_STENCIL_BIT | SCENE_OPAQUE_STENCIL_BIT).toBeLessThan(256);
  });

  it('markSceneOpaqueStencil — Always 테스트 + ZPass 에만 자기 비트를 쓴다', () => {
    const m = new MeshStandardMaterial();
    expect(hasSceneOpaqueStencil(m)).toBe(false);
    markSceneOpaqueStencil(m);
    expect(m.stencilWrite).toBe(true);
    expect(m.stencilFunc).toBe(AlwaysStencilFunc);
    expect(m.stencilWriteMask).toBe(SCENE_OPAQUE_STENCIL_BIT);
    expect(m.stencilRef & SCENE_OPAQUE_STENCIL_BIT).toBe(
      SCENE_OPAQUE_STENCIL_BIT,
    );
    // 실루엣 비트는 건드리지 않는다.
    expect(m.stencilWriteMask & SILHOUETTE_STENCIL_BIT).toBe(0);
    expect(m.stencilZPass).toBe(ReplaceStencilOp);
    expect(m.stencilFail).toBe(KeepStencilOp);
    expect(m.stencilZFail).toBe(KeepStencilOp);
    expect(hasSceneOpaqueStencil(m)).toBe(true);
  });

  it('멱등 — 두 번 불러도 같은 상태', () => {
    const m = new MeshBasicMaterial();
    markSceneOpaqueStencil(m);
    const snapshot = {
      stencilRef: m.stencilRef,
      stencilWriteMask: m.stencilWriteMask,
      stencilFuncMask: m.stencilFuncMask,
    };
    markSceneOpaqueStencil(m);
    expect({
      stencilRef: m.stencilRef,
      stencilWriteMask: m.stencilWriteMask,
      stencilFuncMask: m.stencilFuncMask,
    }).toEqual(snapshot);
  });

  it('렌더 관련 다른 필드(깊이·블렌딩·색)는 건드리지 않는다', () => {
    const m = new MeshStandardMaterial({
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    markSceneOpaqueStencil(m);
    expect(m.transparent).toBe(true);
    expect(m.opacity).toBe(0.4);
    expect(m.depthWrite).toBe(false);
    expect(m.depthTest).toBe(true);
  });

  it('clone 이 표식을 물려받는다 — 알람 tint·잠김 variant 가 잃지 않는 근거', () => {
    const m = new MeshStandardMaterial();
    markSceneOpaqueStencil(m);
    expect(hasSceneOpaqueStencil(m.clone())).toBe(true);
  });

  it('markSceneOpaqueStencils — 배열·단일 모두', () => {
    const a = new MeshBasicMaterial();
    const b = new MeshBasicMaterial();
    markSceneOpaqueStencils([a, b]);
    expect(hasSceneOpaqueStencil(a)).toBe(true);
    expect(hasSceneOpaqueStencil(b)).toBe(true);
    const c = new MeshBasicMaterial();
    markSceneOpaqueStencils(c);
    expect(hasSceneOpaqueStencil(c)).toBe(true);
  });

  it('hasSceneOpaqueStencil — 다른 스텐실 용도(실루엣 헐식 NotEqual)는 표식이 아니다', () => {
    const hull = new MeshBasicMaterial({
      stencilWrite: true,
      stencilFunc: NotEqualStencilFunc,
      stencilRef: SILHOUETTE_STENCIL_BIT,
      stencilWriteMask: 0,
    });
    expect(hasSceneOpaqueStencil(hull)).toBe(false);
  });
});
