import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { collectWorldBounds } from '../world-bounds';

function cube(size: number, position: [number, number, number]) {
  const mesh = new Mesh(
    new BoxGeometry(size, size, size),
    new MeshBasicMaterial(),
  );
  mesh.position.set(...position);
  return mesh;
}

describe('collectWorldBounds', () => {
  it('빈 배열은 null', () => {
    expect(collectWorldBounds([])).toBeNull();
  });

  it('두 메쉬의 월드 AABB 합집합', () => {
    const box = collectWorldBounds([cube(2, [0, 0, 0]), cube(2, [10, 0, 0])])!;
    expect(box.min.toArray()).toEqual([-1, -1, -1]);
    expect(box.max.toArray()).toEqual([11, 1, 1]);
  });

  it('조상 변환이 반영된다 — 부모 matrixWorld 가 갱신돼 있으면 자식만 넘겨도 실린다', () => {
    const parent = new Group();
    parent.position.set(0, 100, 0);
    const child = cube(2, [5, 0, 0]);
    parent.add(child);
    // 실제 앱에서는 렌더러가 매 프레임 해 두는 일.
    parent.updateMatrixWorld(true);
    const box = collectWorldBounds([child])!;
    expect(box.min.toArray()).toEqual([4, 99, -1]);
    expect(box.max.toArray()).toEqual([6, 101, 1]);
  });

  it('특성화: 조상 matrixWorld 는 갱신하지 않는다 — 부모가 stale 이면 부모 이동이 빠진다', () => {
    const parent = new Group();
    parent.position.set(0, 100, 0);
    const child = cube(2, [5, 0, 0]);
    parent.add(child);
    const box = collectWorldBounds([child])!;
    expect(box.min.toArray()).toEqual([4, -1, -1]);
  });

  it('자기 자신의 직전 변형은 갱신 없이도 반영된다 (렌더 루프 밖 호출 대비)', () => {
    const mesh = cube(2, [0, 0, 0]);
    mesh.updateMatrixWorld(true);
    mesh.position.set(30, 0, 0);
    const box = collectWorldBounds([mesh])!;
    expect(box.min.x).toBe(29);
  });

  it('지오메트리가 없는 객체는 월드 위치 한 점만 기여한다', () => {
    const empty = new Object3D();
    empty.position.set(7, 8, 9);
    const box = collectWorldBounds([empty])!;
    expect(box.min.toArray()).toEqual([7, 8, 9]);
    expect(box.max.toArray()).toEqual([7, 8, 9]);
  });

  it('빈 객체와 메쉬가 섞이면 점이 합집합을 늘린다', () => {
    const empty = new Object3D();
    empty.position.set(50, 0, 0);
    const box = collectWorldBounds([cube(2, [0, 0, 0]), empty])!;
    expect(box.max.x).toBe(50);
    expect(box.min.x).toBe(-1);
  });
});
