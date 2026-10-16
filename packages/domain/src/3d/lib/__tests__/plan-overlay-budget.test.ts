import { describe, expect, it } from 'vitest';
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import {
  PLAN_OVERLAY_MAX_TRIANGLES,
  geometryTriangleCount,
  isPlanOverlayEligible,
} from '../plan-overlay-budget';

function geometry(triangles: number, indexed: boolean): BufferGeometry {
  const g = new BufferGeometry();
  if (indexed) {
    g.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    g.setIndex(new BufferAttribute(new Uint32Array(triangles * 3), 1));
  } else {
    g.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(triangles * 9), 3),
    );
  }
  return g;
}

describe('geometryTriangleCount', () => {
  it('인덱스가 있으면 인덱스/3, 없으면 정점/3, 정점이 없으면 0', () => {
    expect(geometryTriangleCount(geometry(10, true))).toBe(10);
    expect(geometryTriangleCount(geometry(7, false))).toBe(7);
    expect(geometryTriangleCount(new BufferGeometry())).toBe(0);
  });
});

describe('isPlanOverlayEligible', () => {
  it('상한 정확값은 통과, 하나 넘으면 제외', () => {
    const material = new MeshBasicMaterial();
    expect(
      isPlanOverlayEligible(
        new Mesh(geometry(PLAN_OVERLAY_MAX_TRIANGLES, true), material),
      ),
    ).toBe(true);
    expect(
      isPlanOverlayEligible(
        new Mesh(geometry(PLAN_OVERLAY_MAX_TRIANGLES + 1, true), material),
      ),
    ).toBe(false);
  });
});
