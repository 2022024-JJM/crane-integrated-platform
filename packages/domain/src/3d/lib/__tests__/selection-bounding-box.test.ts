import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from 'three';
import {
  computeLocalBoundingBoxPoints,
  getCachedLocalBoundingBoxPoints,
} from '../selection-bounding-box';

function unitBoxMesh() {
  return new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
}

/** 24점 배열에서 축별 min/max 를 뽑는다. */
function extent(points: readonly [number, number, number][]) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (let i = 0; i < 3; i += 1) {
      min[i] = Math.min(min[i], p[i]);
      max[i] = Math.max(max[i], p[i]);
    }
  }
  return { min, max };
}

describe('computeLocalBoundingBoxPoints', () => {
  it('단일 메쉬(단위 큐브)는 ±0.5 박스, 12모서리 24점', () => {
    const points = computeLocalBoundingBoxPoints(unitBoxMesh());
    expect(points).not.toBeNull();
    expect(points).toHaveLength(24);
    const { min, max } = extent(points!);
    expect(min).toEqual([-0.5, -0.5, -0.5]);
    expect(max).toEqual([0.5, 0.5, 0.5]);
  });

  it('그룹 프레임에서 자식 메쉬의 오프셋을 보존한다 (노드 오프셋 소실 회귀)', () => {
    const group = new Group();
    const mesh = unitBoxMesh();
    mesh.position.set(2, 0, 0);
    group.add(mesh);

    const { min, max } = extent(computeLocalBoundingBoxPoints(group)!);
    expect(min[0]).toBeCloseTo(1.5, 9);
    expect(max[0]).toBeCloseTo(2.5, 9);
    expect(min[1]).toBeCloseTo(-0.5, 9);
  });

  it('대상 자신의 이동·회전·스케일은 로컬 박스에 영향이 없다 (프레임 독립)', () => {
    const plain = new Group();
    plain.add(unitBoxMesh());
    const moved = new Group();
    moved.add(unitBoxMesh());
    moved.position.set(10, -3, 7);
    moved.rotation.set(0.3, 1.2, -0.7);
    moved.scale.set(2, 3, 4);

    const a = extent(computeLocalBoundingBoxPoints(plain)!);
    const b = extent(computeLocalBoundingBoxPoints(moved)!);
    for (let i = 0; i < 3; i += 1) {
      expect(b.min[i]).toBeCloseTo(a.min[i], 9);
      expect(b.max[i]).toBeCloseTo(a.max[i], 9);
    }
  });

  it('조상(모델 루트)이 원점에서 멀어도 노드 박스는 변하지 않는다 (월드 이중 적용 회귀)', () => {
    const root = new Group();
    root.position.set(100, 0, 0);
    root.rotation.y = Math.PI / 2;
    const node = new Group();
    const mesh = unitBoxMesh();
    mesh.position.set(2, 0, 0);
    node.add(mesh);
    root.add(node);

    const { min, max } = extent(computeLocalBoundingBoxPoints(node)!);
    expect(min[0]).toBeCloseTo(1.5, 9);
    expect(max[0]).toBeCloseTo(2.5, 9);
    expect(min[2]).toBeCloseTo(-0.5, 9);
    expect(max[2]).toBeCloseTo(0.5, 9);
  });

  it('대상 안쪽 중간 노드의 회전은 반영된다 — 45° 돌린 큐브의 AABB 는 √2 로 커진다', () => {
    const target = new Group();
    const pivot = new Group();
    pivot.rotation.y = Math.PI / 4;
    pivot.add(unitBoxMesh());
    target.add(pivot);

    const { min, max } = extent(computeLocalBoundingBoxPoints(target)!);
    const half = Math.SQRT1_2; // 0.5 * √2
    expect(min[0]).toBeCloseTo(-half, 9);
    expect(max[0]).toBeCloseTo(half, 9);
    expect(min[2]).toBeCloseTo(-half, 9);
    expect(max[2]).toBeCloseTo(half, 9);
    expect(min[1]).toBeCloseTo(-0.5, 9);
  });

  it('메쉬가 없는 Empty 는 null', () => {
    expect(computeLocalBoundingBoxPoints(new Object3D())).toBeNull();
  });

  it('빈 그룹 안의 빈 그룹도 null', () => {
    const outer = new Group();
    outer.add(new Group());
    expect(computeLocalBoundingBoxPoints(outer)).toBeNull();
  });

  it('선택 라인(isLine2) 은 메쉬여도 제외한다 — 라인만 있으면 null, 섞이면 무시', () => {
    const line = unitBoxMesh() as Mesh & { isLine2?: boolean };
    line.isLine2 = true;
    line.scale.set(50, 50, 50);

    const onlyLine = new Group();
    onlyLine.add(line);
    expect(computeLocalBoundingBoxPoints(onlyLine)).toBeNull();

    const mixed = new Group();
    mixed.add(unitBoxMesh());
    const bigLine = unitBoxMesh() as Mesh & { isLine2?: boolean };
    bigLine.isLine2 = true;
    bigLine.scale.set(50, 50, 50);
    mixed.add(bigLine);
    const { max } = extent(computeLocalBoundingBoxPoints(mixed)!);
    expect(max[0]).toBeCloseTo(0.5, 9);
  });

  it('segments 모드 라인(isLineSegments2) 도 제외한다', () => {
    const group = new Group();
    group.add(unitBoxMesh());
    const segLine = unitBoxMesh() as Mesh & { isLineSegments2?: boolean };
    segLine.isLineSegments2 = true;
    segLine.scale.set(50, 50, 50);
    group.add(segLine);
    const { max } = extent(computeLocalBoundingBoxPoints(group)!);
    expect(max[0]).toBeCloseTo(0.5, 9);
  });

  it('boundingBox 가 아직 없는 geometry 는 계산해서 쓴다', () => {
    const geometry = new BoxGeometry(2, 2, 2);
    expect(geometry.boundingBox).toBeNull();
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    const { min, max } = extent(computeLocalBoundingBoxPoints(mesh)!);
    expect(min).toEqual([-1, -1, -1]);
    expect(max).toEqual([1, 1, 1]);
    expect(geometry.boundingBox).not.toBeNull();
  });

  it('정점이 없는 geometry(빈 박스)는 건너뛴다', () => {
    const group = new Group();
    group.add(new Mesh(new BufferGeometry(), new MeshBasicMaterial()));
    expect(computeLocalBoundingBoxPoints(group)).toBeNull();
  });

  it('대상의 position/rotation/scale 을 mutate 하지 않는다', () => {
    const group = new Group();
    group.add(unitBoxMesh());
    group.position.set(1, 2, 3);
    group.rotation.set(0.1, 0.2, 0.3);
    group.scale.set(2, 2, 2);
    computeLocalBoundingBoxPoints(group);
    expect(group.position.toArray()).toEqual([1, 2, 3]);
    expect(group.rotation.toArray().slice(0, 3)).toEqual([0.1, 0.2, 0.3]);
    expect(group.scale.toArray()).toEqual([2, 2, 2]);
  });
});

describe('getCachedLocalBoundingBoxPoints', () => {
  it('같은 객체는 동일 참조를 돌려준다', () => {
    const mesh = unitBoxMesh();
    const first = getCachedLocalBoundingBoxPoints(mesh);
    expect(getCachedLocalBoundingBoxPoints(mesh)).toBe(first);
  });

  it('null 결과도 캐시된다 — 메쉬가 나중에 붙어도 재계산하지 않는다(특성화)', () => {
    const group = new Group();
    expect(getCachedLocalBoundingBoxPoints(group)).toBeNull();
    group.add(unitBoxMesh());
    expect(getCachedLocalBoundingBoxPoints(group)).toBeNull();
  });

  it('다른 객체는 서로 다른 캐시 항목이다', () => {
    const a = unitBoxMesh();
    const b = unitBoxMesh();
    expect(getCachedLocalBoundingBoxPoints(a)).not.toBe(
      getCachedLocalBoundingBoxPoints(b),
    );
  });
});
