import { describe, expect, it, vi } from 'vitest';
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
} from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import {
  circleIntersectsBoxXZ,
  isValidZoneRadius,
  meshIntersectsVerticalCylinder,
  pointInCircleXZ,
  segmentDistanceSqXZ,
  triangleIntersectsCircleXZ,
  zoneCenterWorld,
} from '../zone-volumes';

type BvhGeometry = BufferGeometry & { boundsTree?: MeshBVH };

function cube(size = 1): Mesh {
  return new Mesh(new BoxGeometry(size, size, size), new MeshBasicMaterial());
}

function placed(
  mesh: Mesh,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale = 1,
): Mesh {
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.setScalar(scale);
  mesh.updateMatrixWorld(true);
  return mesh;
}

function withBvh(mesh: Mesh): Mesh {
  (mesh.geometry as BvhGeometry).boundsTree = new MeshBVH(mesh.geometry);
  return mesh;
}

describe('isValidZoneRadius', () => {
  it('유한 양수만 참', () => {
    expect(isValidZoneRadius(0.01)).toBe(true);
    expect(isValidZoneRadius(0)).toBe(false);
    expect(isValidZoneRadius(-1)).toBe(false);
    expect(isValidZoneRadius(Number.NaN)).toBe(false);
    expect(isValidZoneRadius(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidZoneRadius('5')).toBe(false);
    expect(isValidZoneRadius(undefined)).toBe(false);
  });
});

describe('pointInCircleXZ / segmentDistanceSqXZ', () => {
  it('경계 정확값은 안, 한 ulp 밖은 밖', () => {
    expect(pointInCircleXZ(3, 4, 0, 0, 5)).toBe(true);
    expect(pointInCircleXZ(3, 4 + 1e-6, 0, 0, 5)).toBe(false);
  });

  it('선분 거리 — 안쪽 투영·끝점 clamp·길이 0 선분', () => {
    expect(segmentDistanceSqXZ(0, 0, 10, 0, 5, 3)).toBe(9);
    expect(segmentDistanceSqXZ(0, 0, 10, 0, 13, 4)).toBe(25);
    expect(segmentDistanceSqXZ(2, 2, 2, 2, 5, 6)).toBe(25);
  });
});

describe('circleIntersectsBoxXZ', () => {
  const box = new Box3(new Vector3(4.5, 100, -0.5), new Vector3(5.5, 200, 0.5));

  it('Y 는 무시한다 — 높이 100 위 박스도 XZ 로만 판정', () => {
    expect(circleIntersectsBoxXZ(box, 0, 0, 4.5)).toBe(true);
  });

  it('모서리 접촉 정확값은 교차, 그보다 조금 멀면 비교차', () => {
    expect(circleIntersectsBoxXZ(box, 0, 0, 4.5)).toBe(true);
    expect(circleIntersectsBoxXZ(box, 0, 0, 4.5 - 1e-6)).toBe(false);
    // 중심 (0, -1) 에서 대각 모서리 (4.5, -0.5) 까지 거리 = √(4.5² + 0.5²)
    const d = Math.hypot(4.5, 0.5);
    expect(circleIntersectsBoxXZ(box, 0, -1, d + 1e-9)).toBe(true);
    expect(circleIntersectsBoxXZ(box, 0, -1, d - 1e-6)).toBe(false);
  });

  it('중심이 박스 안이면 반경과 무관하게 교차', () => {
    expect(circleIntersectsBoxXZ(box, 5, 0, 1e-9)).toBe(true);
  });

  it('NaN 중심·무효 반경은 false', () => {
    expect(circleIntersectsBoxXZ(box, Number.NaN, 0, 5)).toBe(false);
    expect(circleIntersectsBoxXZ(box, 5, 0, 0)).toBe(false);
    expect(circleIntersectsBoxXZ(box, 5, 0, Number.NaN)).toBe(false);
  });
});

describe('triangleIntersectsCircleXZ', () => {
  // 삼각형 (0,0) (10,0) (0,10)
  const tri = [0, 0, 10, 0, 0, 10] as const;

  it('정점이 원 안이면 교차', () => {
    expect(triangleIntersectsCircleXZ(...tri, 10.5, 0, 1)).toBe(true);
  });

  it('원 중심이 삼각형 안(정점은 밖)이면 교차 — 반대 감김 순서도', () => {
    expect(triangleIntersectsCircleXZ(...tri, 2, 2, 0.1)).toBe(true);
    expect(triangleIntersectsCircleXZ(0, 0, 0, 10, 10, 0, 2, 2, 0.1)).toBe(
      true,
    );
  });

  it('변만 스치면 교차, 정확 접선은 교차, 그보다 멀면 비교차', () => {
    // 빗변 x+z=10 에서 (7,7) 까지 거리 = 4/√2
    const d = 4 / Math.SQRT2;
    expect(triangleIntersectsCircleXZ(...tri, 7, 7, d + 1e-9)).toBe(true);
    expect(triangleIntersectsCircleXZ(...tri, 7, 7, d - 1e-6)).toBe(false);
    // 밑변 z=0 에서 (5,-2)
    expect(triangleIntersectsCircleXZ(...tri, 5, -2, 2)).toBe(true);
    expect(triangleIntersectsCircleXZ(...tri, 5, -2, 1.999999)).toBe(false);
  });

  it('원이 삼각형과 완전히 떨어져 있으면 비교차', () => {
    expect(triangleIntersectsCircleXZ(...tri, 20, 20, 5)).toBe(false);
  });

  it('퇴화(일직선) 삼각형은 예외 없이 변 거리로 판정한다', () => {
    expect(triangleIntersectsCircleXZ(0, 0, 5, 0, 10, 0, 5, 1, 1)).toBe(true);
    expect(triangleIntersectsCircleXZ(0, 0, 5, 0, 10, 0, 5, 1.5, 1)).toBe(
      false,
    );
  });
});

describe('zoneCenterWorld', () => {
  it('오프셋 없음 → 루트 XZ, Y 는 루트 높이', () => {
    const m = new Matrix4().makeTranslation(3, 7, -2);
    expect(zoneCenterWorld(m, undefined, new Vector3()).toArray()).toEqual([
      3, 7, -2,
    ]);
  });

  it('오프셋은 월드 축으로 더한다(회전 무관)', () => {
    const m = new Matrix4()
      .makeRotationY(Math.PI / 2)
      .setPosition(new Vector3(3, 0, -2));
    const out = zoneCenterWorld(m, [1, -4], new Vector3());
    expect(out.x).toBeCloseTo(4);
    expect(out.z).toBeCloseTo(-6);
  });
});

describe('meshIntersectsVerticalCylinder', () => {
  it('BVH 가 없으면 null', () => {
    expect(
      meshIntersectsVerticalCylinder(placed(cube(), [0, 0, 0]), 0, 0, 5),
    ).toBeNull();
  });

  it('무효 반경·NaN 중심은 트리를 건드리지 않고 false', () => {
    const mesh = withBvh(placed(cube(), [0, 0, 0]));
    const tree = (mesh.geometry as BvhGeometry).boundsTree as MeshBVH;
    const spy = vi.spyOn(tree, 'shapecast');
    expect(meshIntersectsVerticalCylinder(mesh, 0, 0, 0)).toBe(false);
    expect(meshIntersectsVerticalCylinder(mesh, 0, 0, Number.NaN)).toBe(false);
    expect(meshIntersectsVerticalCylinder(mesh, Number.NaN, 0, 1)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('단위 큐브 (5,0,0): r 4.5 는 접촉(교차), 4.49 는 비교차', () => {
    const mesh = withBvh(placed(cube(), [5, 0, 0]));
    expect(meshIntersectsVerticalCylinder(mesh, 0, 0, 4.5)).toBe(true);
    expect(meshIntersectsVerticalCylinder(mesh, 0, 0, 4.49)).toBe(false);
  });

  it('Y 는 무시한다 — 높이 100 의 큐브도 바닥 원 안이다', () => {
    const mesh = withBvh(placed(cube(), [0, 100, 0]));
    expect(meshIntersectsVerticalCylinder(mesh, 0, 0, 0.1)).toBe(true);
  });

  it('원이 메쉬를 통째로 담으면(CONTAINED) 교차', () => {
    const mesh = withBvh(placed(cube(), [3, 0, 3]));
    expect(meshIntersectsVerticalCylinder(mesh, 0, 0, 10)).toBe(true);
  });

  it('yaw 45° 큐브: AABB 는 교차라 하지만 메쉬는 비교차 — 박스보다 정확하다', () => {
    const mesh = withBvh(placed(cube(), [0, 0, 0], [0, Math.PI / 4, 0]));
    const box = new Box3().setFromObject(mesh);
    expect(circleIntersectsBoxXZ(box, 0.6, 0.6, 0.1)).toBe(true);
    expect(meshIntersectsVerticalCylinder(mesh, 0.6, 0.6, 0.1)).toBe(false);
    // 마름모 변 위의 점은 교차
    expect(meshIntersectsVerticalCylinder(mesh, 0.5, 0.2, 0.1)).toBe(true);
  });

  it('X 축으로 90° 눕힌 긴 박스: 원기둥은 월드 수직이라 월드 Z 방향 끝도 잡는다', () => {
    const mesh = new Mesh(new BoxGeometry(1, 4, 1), new MeshBasicMaterial());
    withBvh(placed(mesh, [0, 0, 0], [Math.PI / 2, 0, 0]));
    expect(meshIntersectsVerticalCylinder(mesh, 0, 1.5, 0.1)).toBe(true);
    expect(meshIntersectsVerticalCylinder(mesh, 0, 2.5, 0.1)).toBe(false);
    // 로컬 수직 원기둥이었다면 y 방향(=월드 -Z) 4 길이가 아니라 1 로 보였을 것
    expect(meshIntersectsVerticalCylinder(mesh, 1.2, 0, 0.1)).toBe(false);
  });

  it('속이 빈 고리(내경 2·외경 3): 중심 r1 은 비교차, r2 는 내경 접촉', () => {
    const mesh = new Mesh(new RingGeometry(2, 3, 32), new MeshBasicMaterial());
    withBvh(placed(mesh, [0, 0, 0], [-Math.PI / 2, 0, 0]));
    expect(meshIntersectsVerticalCylinder(mesh, 0, 0, 1)).toBe(false);
    expect(meshIntersectsVerticalCylinder(mesh, 0, 0, 2)).toBe(true);
  });

  it('scale 2 메쉬: 반경은 월드 단위다', () => {
    const mesh = withBvh(placed(cube(), [0, 0, 0], [0, 0, 0], 2));
    expect(meshIntersectsVerticalCylinder(mesh, 1.5, 0, 0.5)).toBe(true);
    expect(meshIntersectsVerticalCylinder(mesh, 1.5, 0, 0.49)).toBe(false);
  });
});
