import { describe, expect, it } from 'vitest';
import { Group, Object3D } from 'three';
import { isInsideSubtree, resolveGhostOpacity } from '../ghost-opacity';

describe('isInsideSubtree', () => {
  it('자기 자신·자식·손자는 안', () => {
    const root = new Group();
    const child = new Object3D();
    const grandchild = new Object3D();
    root.add(child);
    child.add(grandchild);
    expect(isInsideSubtree(root, root)).toBe(true);
    expect(isInsideSubtree(child, root)).toBe(true);
    expect(isInsideSubtree(grandchild, root)).toBe(true);
  });

  it('형제·조상·분리된 노드는 밖', () => {
    const parent = new Group();
    const a = new Object3D();
    const b = new Object3D();
    parent.add(a);
    parent.add(b);
    expect(isInsideSubtree(b, a)).toBe(false);
    expect(isInsideSubtree(parent, a)).toBe(false);
    expect(isInsideSubtree(new Object3D(), a)).toBe(false);
  });
});

describe('resolveGhostOpacity', () => {
  it('안이면 base 그대로, 밖이면 base × ghost', () => {
    expect(resolveGhostOpacity(1, true, 0.15)).toBe(1);
    expect(resolveGhostOpacity(1, false, 0.15)).toBeCloseTo(0.15);
    expect(resolveGhostOpacity(0.5, false, 0.2)).toBeCloseTo(0.1);
  });

  it('[0,1] 경계 — 정확값은 통과, 밖은 잘린다', () => {
    expect(resolveGhostOpacity(0, false, 0.5)).toBe(0);
    expect(resolveGhostOpacity(1, true, 2)).toBe(1);
    expect(resolveGhostOpacity(1.5, true, 1)).toBe(1);
    expect(resolveGhostOpacity(-0.2, false, 0.5)).toBe(0);
    expect(resolveGhostOpacity(1, false, 1.5)).toBe(1);
  });
});
