import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { markOverlayMesh } from '@crane/domain/3d';
import { MIN_MESH_EXTENT, SEPARATION_MARGIN } from '../scene-collision-pairs';
import {
  buildProbeMeshes,
  probeEntriesSeparated,
  probeEntryPair,
  refreshProbeBoxes,
  unionProbeBox,
  type ProbeEntry,
  type ProbeHitMeshes,
} from '../scene-collision-probe';

type BvhGeometry = BufferGeometry & { boundsTree?: MeshBVH };

function cube(size = 1): Mesh {
  return new Mesh(new BoxGeometry(size, size, size), new MeshBasicMaterial());
}

function withBvh(mesh: Mesh): Mesh {
  (mesh.geometry as BvhGeometry).boundsTree = new MeshBVH(mesh.geometry);
  return mesh;
}

/** 이름 있는 자식 메쉬 1개를 가진 모델 루트. getMeshPath 가 경로를 만들 수 있어야 한다. */
function mountModel(x: number, { bvh = true, size = 1 } = {}) {
  const root = new Group();
  root.name = 'model-root';
  const body = cube(size);
  body.name = 'Body';
  root.add(body);
  root.position.x = x;
  root.updateMatrixWorld(true);
  if (bvh) withBvh(body);
  return { root, body };
}

function entryOf(root: Object3D): ProbeEntry {
  const entry: ProbeEntry = { meshes: buildProbeMeshes(root), box: new Box3() };
  refreshProbeBoxes(entry);
  return entry;
}

function moveTo(root: Object3D, x: number): void {
  root.position.x = x;
  root.updateMatrixWorld(true);
}

let out: ProbeHitMeshes;

beforeEach(() => {
  out = { a: null, b: null };
});

describe('buildProbeMeshes', () => {
  it('경로를 구할 수 있는 메쉬를 모으고 box 는 빈 상태로 시작한다', () => {
    const { root, body } = mountModel(0);
    const meshes = buildProbeMeshes(root);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].mesh).toBe(body);
    expect(meshes[0].nodePath).toBe('[0]Body');
    // 박스 갱신 시점은 호출자가 정한다 — 생성 시점엔 비어 있다.
    expect(meshes[0].box.isEmpty()).toBe(true);
  });

  it('MIN_MESH_EXTENT 미만 메쉬는 뺀다 — 경계 정확값은 남는다', () => {
    // 정육면체 한 변 s 의 대각 길이는 s*sqrt(3). 임계는 대각 기준이다.
    const justUnder = (MIN_MESH_EXTENT / Math.sqrt(3)) * 0.9;
    const justOver = (MIN_MESH_EXTENT / Math.sqrt(3)) * 1.1;
    expect(buildProbeMeshes(mountModel(0, { size: justUnder }).root)).toEqual(
      [],
    );
    expect(
      buildProbeMeshes(mountModel(0, { size: justOver }).root),
    ).toHaveLength(1);
  });

  it('정점 없는 지오메트리·오버레이 메쉬는 수집되지 않는다', () => {
    const root = new Group();
    const empty = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
    empty.name = 'Empty';
    const overlay = cube();
    overlay.name = 'Overlay';
    markOverlayMesh(overlay);
    const real = cube();
    real.name = 'Body';
    root.add(empty, overlay, real);
    root.updateMatrixWorld(true);
    expect(buildProbeMeshes(root).map((m) => m.mesh)).toEqual([real]);
  });

  it('빈 루트는 빈 배열', () => {
    expect(buildProbeMeshes(new Group())).toEqual([]);
  });
});

describe('unionProbeBox / refreshProbeBoxes', () => {
  it('메쉬 박스의 합집합을 entry.box 에 쓴다(참조 유지)', () => {
    const root = new Group();
    const a = cube();
    a.name = 'A';
    a.position.x = -5;
    const b = cube();
    b.name = 'B';
    b.position.x = 5;
    root.add(a, b);
    root.updateMatrixWorld(true);
    const entry: ProbeEntry = {
      meshes: buildProbeMeshes(root),
      box: new Box3(),
    };
    const before = entry.box;
    refreshProbeBoxes(entry);
    expect(entry.box).toBe(before);
    expect(entry.box.min.x).toBeCloseTo(-5.5);
    expect(entry.box.max.x).toBeCloseTo(5.5);
  });

  it('메쉬가 없으면 합집합은 빈 박스다', () => {
    const entry: ProbeEntry = { meshes: [], box: new Box3() };
    entry.box.setFromCenterAndSize(
      { x: 0, y: 0, z: 0 } as never,
      {
        x: 1,
        y: 1,
        z: 1,
      } as never,
    );
    unionProbeBox(entry);
    expect(entry.box.isEmpty()).toBe(true);
  });

  it('refreshProbeBoxes 는 이동 뒤 메쉬 박스를 다시 잰다', () => {
    const { root } = mountModel(0);
    const entry = entryOf(root);
    expect(entry.box.min.x).toBeCloseTo(-0.5);
    moveTo(root, 10);
    refreshProbeBoxes(entry);
    expect(entry.box.min.x).toBeCloseTo(9.5);
  });
});

describe('probeEntryPair', () => {
  it('겹치면 hit 이고 out 에 부딪힌 메쉬 쌍이 담긴다', () => {
    const a = mountModel(0);
    const b = mountModel(0.5);
    expect(probeEntryPair(entryOf(a.root), entryOf(b.root), out)).toBe('hit');
    expect(out.a?.mesh).toBe(a.body);
    expect(out.b?.mesh).toBe(b.body);
  });

  it('떨어지면 clear 이고 out 은 비워진다', () => {
    const a = mountModel(0);
    const b = mountModel(10);
    out.a = { mesh: cube(), nodePath: 'stale', box: new Box3() };
    expect(probeEntryPair(entryOf(a.root), entryOf(b.root), out)).toBe('clear');
    expect(out.a).toBeNull();
    expect(out.b).toBeNull();
  });

  it('모델 AABB 는 겹치지만 삼각형은 안 닿으면 clear', () => {
    // ㄴ 자로 어긋난 두 모델 — 합집합 박스는 겹치고 메쉬는 떨어져 있다.
    const rootA = new Group();
    const a1 = cube();
    a1.name = 'A1';
    const a2 = cube();
    a2.name = 'A2';
    a2.position.set(4, 0, 0);
    rootA.add(a1, a2);
    rootA.updateMatrixWorld(true);
    withBvh(a1);

    const rootB = new Group();
    const b1 = cube();
    b1.name = 'B1';
    b1.position.set(2, 0, 0);
    rootB.add(b1);
    rootB.updateMatrixWorld(true);
    withBvh(b1);

    const ea = entryOf(rootA);
    const eb = entryOf(rootB);
    expect(ea.box.intersectsBox(eb.box)).toBe(true);
    expect(probeEntryPair(ea, eb, out)).toBe('clear');
  });

  it('한쪽에 BVH 가 없으면 no-bvh 를 돌려준다(판정 불가)', () => {
    const a = mountModel(0, { bvh: false });
    const b = mountModel(0.5);
    expect(probeEntryPair(entryOf(a.root), entryOf(b.root), out)).toBe(
      'no-bvh',
    );
    expect(out.a).toBeNull();
  });

  it('BVH 없는 쌍과 확정 hit 이 함께 있으면 hit 이 이긴다', () => {
    const rootA = new Group();
    const noBvh = cube();
    noBvh.name = 'NoBvh';
    const hasBvh = cube();
    hasBvh.name = 'HasBvh';
    rootA.add(noBvh, hasBvh);
    rootA.updateMatrixWorld(true);
    withBvh(hasBvh);

    const b = mountModel(0.5);
    expect(probeEntryPair(entryOf(rootA), entryOf(b.root), out)).toBe('hit');
    expect(out.a?.mesh).toBe(hasBvh);
  });

  it('OBB 단계가 후보를 걸러 삼각형 검사를 부르지 않는다', () => {
    const a = mountModel(0);
    const b = mountModel(10);
    const bvh = (a.body.geometry as BvhGeometry).boundsTree as MeshBVH;
    const spy = vi.spyOn(bvh, 'intersectsGeometry');
    probeEntryPair(entryOf(a.root), entryOf(b.root), out);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('메쉬가 없는 항목끼리는 clear', () => {
    const empty: ProbeEntry = { meshes: [], box: new Box3() };
    expect(probeEntryPair(empty, empty, out)).toBe('clear');
  });
});

describe('probeEntriesSeparated', () => {
  it('SEPARATION_MARGIN 경계 — 정확값은 아직 붙음, 넘으면 분리', () => {
    const a = mountModel(0);
    // 한 변 1 큐브 두 개의 표면 간격이 정확히 margin 이 되는 거리.
    const atMargin = 1 + SEPARATION_MARGIN;
    const b = mountModel(atMargin);
    expect(probeEntriesSeparated(entryOf(a.root), entryOf(b.root))).toBe(false);

    moveTo(b.root, atMargin + 0.01);
    const eb = entryOf(b.root);
    expect(probeEntriesSeparated(entryOf(a.root), eb)).toBe(true);
  });

  it('관통 중이면 분리 아님', () => {
    const a = mountModel(0);
    const b = mountModel(0.3);
    expect(probeEntriesSeparated(entryOf(a.root), entryOf(b.root))).toBe(false);
  });

  it('멀리 떨어졌으면 합집합 박스 단계에서 바로 분리', () => {
    const a = mountModel(0);
    const b = mountModel(100);
    expect(probeEntriesSeparated(entryOf(a.root), entryOf(b.root))).toBe(true);
  });

  it('BVH 가 없으면 보수적으로 붙음으로 본다', () => {
    // 간격이 margin 안이라 AABB·OBB 단계를 통과해 삼각형 판정까지 내려가고,
    // 거기서 null 이 나온다. margin 밖이면 AABB 단계에서 분리로 끝나므로
    // BVH 유무가 결과에 영향을 주지 않는다(아래 짝 케이스).
    const a = mountModel(0, { bvh: false });
    const b = mountModel(1 + SEPARATION_MARGIN * 0.5, { bvh: false });
    expect(probeEntriesSeparated(entryOf(a.root), entryOf(b.root))).toBe(false);
  });

  it('BVH 가 없어도 margin 밖이면 AABB 단계에서 분리로 끝난다', () => {
    const a = mountModel(0, { bvh: false });
    const b = mountModel(1 + SEPARATION_MARGIN * 2, { bvh: false });
    expect(probeEntriesSeparated(entryOf(a.root), entryOf(b.root))).toBe(true);
  });
});
