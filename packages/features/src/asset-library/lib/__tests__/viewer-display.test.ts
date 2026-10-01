import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import {
  applyLodLevel,
  applyViewMode,
  countLodLevels,
  createViewModeMaterials,
  type OriginalMaterialMap,
} from '../viewer-display';

function mesh() {
  return new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
}

function carrier(group: Record<string, unknown>, lod: number) {
  const node = mesh();
  node.userData = { ...group, lod };
  return node;
}

describe('applyViewMode', () => {
  it('교체했다가 lit 으로 돌아오면 원래 머티리얼이다', () => {
    const a = mesh();
    const b = mesh();
    const originalA = a.material;
    const originalB = b.material;
    const root = new Group();
    root.add(a, b);
    const materials = createViewModeMaterials('#ffffff');
    const originals: OriginalMaterialMap = new Map();

    applyViewMode(root, 'wireframe', materials, originals);
    expect(a.material).toBe(materials.wireframe);
    expect(b.material).toBe(materials.wireframe);

    // 모드를 거쳐 가도 원본은 처음 것을 기억한다(교체용을 원본으로 덮지 않는다).
    applyViewMode(root, 'clay', materials, originals);
    applyViewMode(root, 'normals', materials, originals);
    applyViewMode(root, 'lit', materials, originals);
    expect(a.material).toBe(originalA);
    expect(b.material).toBe(originalB);
  });

  it('머티리얼 배열도 통째로 되돌린다', () => {
    const multi = new Mesh(new BoxGeometry(1, 1, 1), [
      new MeshBasicMaterial(),
      new MeshBasicMaterial(),
    ]);
    const original = multi.material;
    const materials = createViewModeMaterials('#ffffff');
    const originals: OriginalMaterialMap = new Map();
    applyViewMode(multi, 'clay', materials, originals);
    expect(multi.material).toBe(materials.clay);
    applyViewMode(multi, 'lit', materials, originals);
    expect(multi.material).toBe(original);
  });

  it('처음부터 lit 을 적용해도 아무것도 바뀌지 않는다', () => {
    const a = mesh();
    const original = a.material;
    applyViewMode(a, 'lit', createViewModeMaterials('#fff'), new Map());
    expect(a.material).toBe(original);
  });

  it('메쉬가 없는 씬에는 아무 일도 없다', () => {
    const originals: OriginalMaterialMap = new Map();
    applyViewMode(new Group(), 'clay', createViewModeMaterials('#fff'), originals);
    expect(originals.size).toBe(0);
  });
});

describe('countLodLevels / applyLodLevel', () => {
  it('LOD 가 없는 모델은 1 단계이고 가시성을 건드리지 않는다', () => {
    const root = new Group();
    const plain = mesh();
    plain.visible = false;
    root.add(plain);
    expect(countLodLevels(root)).toBe(1);
    applyLodLevel(root, 0);
    expect(plain.visible).toBe(false);
  });

  it('고른 단계만 보이게 한다', () => {
    const root = new Group();
    const levels = [0, 1, 2].map((lod) => carrier({ lodGroup: 'hull' }, lod));
    root.add(...levels);
    expect(countLodLevels(root)).toBe(3);

    applyLodLevel(root, 1);
    expect(levels.map((n) => n.visible)).toEqual([false, true, false]);
    applyLodLevel(root, 0);
    expect(levels.map((n) => n.visible)).toEqual([true, false, false]);
  });

  it('요청한 단계가 없는 묶음은 그 묶음의 가장 거친 단계를 보인다', () => {
    const root = new Group();
    const deep = [0, 1, 2, 3].map((lod) => carrier({ tile: [0, 0] }, lod));
    const shallow = [0, 1].map((lod) => carrier({ tile: [0, 1] }, lod));
    root.add(...deep, ...shallow);

    applyLodLevel(root, 3);
    expect(deep.map((n) => n.visible)).toEqual([false, false, false, true]);
    expect(shallow.map((n) => n.visible)).toEqual([false, true]);
  });

  it('캐리어의 자손은 캐리어로 세지 않는다(extras 가 자식 메쉬에 복제된다)', () => {
    const top = new Group();
    top.userData = { tile: [0, 0], lod: 1 };
    const child = carrier({ tile: [0, 0] }, 1);
    top.add(child);
    const base = carrier({ tile: [0, 0] }, 0);
    const root = new Group();
    root.add(base, top);

    applyLodLevel(root, 0);
    // 최상위 캐리어만 끈다 — 자식까지 끄면 캐리어를 켜도 타일이 안 보인다.
    expect(top.visible).toBe(false);
    expect(child.visible).toBe(true);
    applyLodLevel(root, 1);
    expect(top.visible).toBe(true);
    expect(base.visible).toBe(false);
  });

  it('lod 없이 tile 만 있는 타일은 0 단계로 본다', () => {
    const root = new Group();
    const tile = mesh();
    tile.userData = { tile: [1, 1] };
    root.add(tile);
    expect(countLodLevels(root)).toBe(1);
    applyLodLevel(root, 2);
    expect(tile.visible).toBe(true);
  });
});
