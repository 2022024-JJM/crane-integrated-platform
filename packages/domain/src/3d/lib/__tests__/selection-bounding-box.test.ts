import { describe, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from 'three';
import {
  ORIENTED_BOX_MIN_GAIN,
  computeLocalBoundingBoxPoints,
  getCachedLocalBoundingBoxPoints,
} from '../selection-bounding-box';

function unitBoxMesh() {
  return new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
}

/**
 * 바닥 사각형의 두 변 길이. 24점의 앞 8점이 바닥 4변(c0→c1, c1→c2, …)이다.
 */
function footprintEdges(points: readonly [number, number, number][]) {
  const [c0, c1, , c2] = points;
  return {
    u: Math.hypot(c1[0] - c0[0], c1[2] - c0[2]),
    v: Math.hypot(c2[0] - c1[0], c2[2] - c1[2]),
  };
}

/**
 * 대상 프레임의 점 p 가 박스 안(경계 허용 eps)인지 — 바닥 c0 기준 두 변 축에
 * 투영해 [0, 1] 안, 높이는 [minY, maxY] 안.
 */
function boxContains(
  points: readonly [number, number, number][],
  p: readonly [number, number, number],
  eps = 1e-6,
) {
  const [c0, c1, , c2] = points;
  const ux = c1[0] - c0[0];
  const uz = c1[2] - c0[2];
  const vx = c2[0] - c1[0];
  const vz = c2[2] - c1[2];
  const dx = p[0] - c0[0];
  const dz = p[2] - c0[2];
  const su = (dx * ux + dz * uz) / (ux * ux + uz * uz || 1);
  const sv = (dx * vx + dz * vz) / (vx * vx + vz * vz || 1);
  const { min, max } = extent(points);
  return (
    su >= -eps &&
    su <= 1 + eps &&
    sv >= -eps &&
    sv <= 1 + eps &&
    p[1] >= min[1] - eps &&
    p[1] <= max[1] + eps
  );
}

/** 대상 프레임으로 옮긴 메쉬 정점 전부 */
function verticesInFrame(target: Object3D): [number, number, number][] {
  target.updateWorldMatrix(true, true);
  const toLocal = target.matrixWorld.clone().invert();
  const out: [number, number, number][] = [];
  target.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const position = child.geometry.getAttribute('position');
    const m = toLocal.clone().multiply(child.matrixWorld);
    for (let i = 0; i < position.count; i += 1) {
      const v = new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i),
      ).applyMatrix4(m);
      out.push([v.x, v.y, v.z]);
    }
  });
  return out;
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

  it('대상 안쪽 중간 노드의 Y 회전은 박스 방향이 된다 — 45° 돌린 큐브에 딱 맞는다', () => {
    const target = new Group();
    const pivot = new Group();
    pivot.rotation.y = Math.PI / 4;
    pivot.add(unitBoxMesh());
    target.add(pivot);

    const points = computeLocalBoundingBoxPoints(target)!;
    const { min, max } = extent(points);
    const half = Math.SQRT1_2; // 꼭짓점이 축 위에 온다
    expect(min[0]).toBeCloseTo(-half, 9);
    expect(max[0]).toBeCloseTo(half, 9);
    expect(min[1]).toBeCloseTo(-0.5, 9);
    expect(max[1]).toBeCloseTo(0.5, 9);
    // 바닥은 변 길이 1 의 정사각형(축 정렬이면 √2).
    const { u, v } = footprintEdges(points);
    expect(u).toBeCloseTo(1, 9);
    expect(v).toBeCloseTo(1, 9);
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

/** 정점에 Y 회전을 구운 w×h×d 박스 메쉬 — 지도 GLB 의 건물처럼 노드 회전이 없다. */
function bakedBoxMesh(w: number, h: number, d: number, degrees: number) {
  const geometry = new BoxGeometry(w, h, d);
  geometry.rotateY((degrees * Math.PI) / 180);
  return new Mesh(geometry, new MeshBasicMaterial());
}

/** 위치를 정규화 Int16 으로 양자화한 사본(KHR_mesh_quantization) — 노드 배율이 range. */
function quantizedMesh(source: Mesh, range: number) {
  const position = source.geometry.getAttribute('position');
  const ints = new Int16Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    ints[i * 3] = Math.round((position.getX(i) / range) * 32767);
    ints[i * 3 + 1] = Math.round((position.getY(i) / range) * 32767);
    ints[i * 3 + 2] = Math.round((position.getZ(i) / range) * 32767);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(ints, 3, true));
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  mesh.scale.setScalar(range);
  return mesh;
}

describe('computeLocalBoundingBoxPoints — 발자국 방향 박스', () => {
  it('정점에 구운 39° 건물(노드 회전 없음)은 건물 방향의 2×1 박스', () => {
    const node = new Group();
    node.add(bakedBoxMesh(2, 1, 1, 39));
    const points = computeLocalBoundingBoxPoints(node)!;
    // 정점이 Float32 라 1e-7 수준 오차가 있다.
    const { u, v } = footprintEdges(points);
    expect(Math.min(u, v)).toBeCloseTo(1, 6);
    expect(Math.max(u, v)).toBeCloseTo(2, 6);
    const { min, max } = extent(points);
    expect(min[1]).toBeCloseTo(-0.5, 9);
    expect(max[1]).toBeCloseTo(0.5, 9);
    for (const p of verticesInFrame(node)) {
      expect(boxContains(points, p)).toBe(true);
    }
  });

  it(`이득이 ORIENTED_BOX_MIN_GAIN 미만(2° 정사각형)이면 축 정렬로 남는다`, () => {
    // 2° 돌린 정사각형의 축 정렬/최소 넓이 비 = (cos2°+sin2°)² ≈ 1.07
    const ratio = (Math.cos(Math.PI / 90) + Math.sin(Math.PI / 90)) ** 2;
    expect(1 - 1 / ratio).toBeLessThan(ORIENTED_BOX_MIN_GAIN);
    const node = new Group();
    node.add(bakedBoxMesh(1, 1, 1, 2));
    const points = computeLocalBoundingBoxPoints(node)!;
    expect(new Set(points.map((p) => p[0])).size).toBe(2);
    expect(new Set(points.map((p) => p[2])).size).toBe(2);
  });

  it('양자화(정규화 Int16) 건물도 노드 배율을 거쳐 같은 박스 — 양자화 오차 안', () => {
    const node = new Group();
    node.add(quantizedMesh(bakedBoxMesh(2, 1, 1, 39), 1.5));
    const points = computeLocalBoundingBoxPoints(node)!;
    const { u, v } = footprintEdges(points);
    const [short, long] = [u, v].sort((a, b) => a - b);
    expect(short).toBeCloseTo(1, 3);
    expect(long).toBeCloseTo(2, 3);
    for (const p of verticesInFrame(node)) {
      expect(boxContains(points, p)).toBe(true);
    }
  });

  it('정규화 Int16 의 −32768 은 −1 로 풀린다(−32767 과 같다)', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(
        new Int16Array([
          -32768, 0, -32767, 32767, 0, -32767, 32767, 16384, 32767, -32767, 0,
          32767,
        ]),
        3,
        true,
      ),
    );
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    mesh.scale.setScalar(10);
    mesh.position.set(5, 0, 0);
    const node = new Group();
    node.add(mesh);
    const { min, max } = extent(computeLocalBoundingBoxPoints(node)!);
    expect(min[0]).toBeCloseTo(-5, 9);
    expect(max[0]).toBeCloseTo(15, 9);
    expect(min[2]).toBeCloseTo(-10, 9);
    expect(max[2]).toBeCloseTo(10, 9);
    expect(min[1]).toBeCloseTo(0, 9);
    expect(max[1]).toBeCloseTo((16384 / 32767) * 10, 9);
  });

  it('interleaved 위치 속성도 읽는다', () => {
    const source = bakedBoxMesh(2, 1, 1, 39).geometry.getAttribute('position');
    const data = new Float32Array(source.count * 6);
    for (let i = 0; i < source.count; i += 1) {
      data.set(
        [9, 9, 9, source.getX(i), source.getY(i), source.getZ(i)],
        i * 6,
      );
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new InterleavedBufferAttribute(new InterleavedBuffer(data, 6), 3, 3),
    );
    const node = new Group();
    node.add(new Mesh(geometry, new MeshBasicMaterial()));
    const { u, v } = footprintEdges(computeLocalBoundingBoxPoints(node)!);
    expect(Math.min(u, v)).toBeCloseTo(1, 6);
    expect(Math.max(u, v)).toBeCloseTo(2, 6);
  });

  it('X 축으로 기운 노드(리그 관절)는 정점을 옮겨 감싼다 — 모든 정점 포함, 높이는 정점 그대로', () => {
    const target = new Group();
    const joint = new Group();
    joint.rotation.set(0.4, 0.7, 0.2);
    joint.add(bakedBoxMesh(2, 1, 1, 15));
    target.add(joint);
    const points = computeLocalBoundingBoxPoints(target)!;
    const vertices = verticesInFrame(target);
    for (const p of vertices) {
      expect(boxContains(points, p)).toBe(true);
    }
    const { min, max } = extent(points);
    expect(min[1]).toBeCloseTo(Math.min(...vertices.map((p) => p[1])), 9);
    expect(max[1]).toBeCloseTo(Math.max(...vertices.map((p) => p[1])), 9);
  });

  it('흩어진 여러 메쉬(지도 전체)를 한 발자국으로 합쳐 방향을 정한다', () => {
    // rotateY(30°) 는 긴 변(X)을 XZ 각 −30° 방향으로 돌린다 — 그 줄을 따라
    // 건물 다섯 채를 4 간격으로 늘어놓는다.
    const map = new Group();
    for (let i = 0; i < 5; i += 1) {
      const building = bakedBoxMesh(2, 1, 1, 30);
      const along = i * 4;
      building.position.set(
        along * Math.cos(Math.PI / 6),
        0,
        -along * Math.sin(Math.PI / 6),
      );
      map.add(building);
    }
    const points = computeLocalBoundingBoxPoints(map)!;
    for (const p of verticesInFrame(map)) {
      expect(boxContains(points, p)).toBe(true);
    }
    // 바닥은 줄 길이(4×4 + 2) × 건물 폭 1.
    const { u, v } = footprintEdges(points);
    expect(Math.min(u, v)).toBeCloseTo(1, 6);
    expect(Math.max(u, v)).toBeCloseTo(18, 6);
  });

  it('같은 위치 속성을 공유하는 두 메쉬(LOD 사본)는 하나일 때와 같은 박스', () => {
    const lod0 = bakedBoxMesh(2, 1, 1, 39);
    const lod1 = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
    lod1.geometry.setAttribute(
      'position',
      lod0.geometry.getAttribute('position'),
    );
    const single = new Group();
    single.add(lod0.clone());
    const pair = new Group();
    pair.add(lod0, lod1);
    const a = computeLocalBoundingBoxPoints(single)!;
    const b = computeLocalBoundingBoxPoints(pair)!;
    a.forEach((p, i) => {
      for (let k = 0; k < 3; k += 1) expect(b[i][k]).toBeCloseTo(p[k], 12);
    });
  });

  it('성분 하나라도 NaN 인 정점은 버리고 나머지로 박스를 만든다', () => {
    const source = new BoxGeometry(1, 1, 1).getAttribute('position');
    const values = Array.from(source.array as Float32Array);
    values.push(NaN, NaN, NaN, 0, NaN, 50);
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(values), 3),
    );
    const silence = vi.spyOn(console, 'error').mockImplementation(() => {});
    const points = computeLocalBoundingBoxPoints(
      new Mesh(geometry, new MeshBasicMaterial()),
    );
    silence.mockRestore();
    expect(points).not.toBeNull();
    expect(points!.flat().every(Number.isFinite)).toBe(true);
    const { min, max } = extent(points!);
    expect(min).toEqual([-0.5, -0.5, -0.5]);
    expect(max).toEqual([0.5, 0.5, 0.5]);
  });

  it('바닥이 한 점·선분뿐인 메쉬(수직선)도 유한한 퇴화 박스', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([1, 0, 2, 1, 5, 2]), 3),
    );
    const points = computeLocalBoundingBoxPoints(
      new Mesh(geometry, new MeshBasicMaterial()),
    )!;
    const { min, max } = extent(points);
    expect(min).toEqual([1, 0, 2]);
    expect(max).toEqual([1, 5, 2]);
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
