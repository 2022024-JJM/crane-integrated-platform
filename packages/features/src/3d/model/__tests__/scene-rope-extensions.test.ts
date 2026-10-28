import { describe, expect, it } from 'vitest';
import {
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Raycaster,
  Vector3,
  type Object3D,
} from 'three';
import { SceneRopeExtensions } from '../scene-rope-extensions';

type CableSegment = Parameters<SceneRopeExtensions['update']>[0][number];

/**
 * 트롤리(y 60) 아래 로프 노드 — 노드 원점 y 45, 로컬 가닥 y 0~5(월드 45~50).
 * 트롤리 높이 60 까지 이으면 관 길이 10.
 */
function ropeRig(geometry: BufferGeometry = strandGeometry()) {
  const trolley = new Group();
  trolley.position.set(0, 60, 0);
  const node = new Group();
  node.position.set(0, -15, 0);
  const material = new MeshStandardMaterial();
  const mesh: Mesh = new Mesh(geometry, material);
  node.add(mesh);
  trolley.add(node);
  trolley.updateMatrixWorld(true);
  return { trolley, node, mesh, material };
}

function strandGeometry() {
  const g = new CylinderGeometry(0.1, 0.1, 5, 8);
  g.translate(0, 2.5, 0);
  return g;
}

function cable(node: Object3D | null, trolleyY = 60): CableSegment {
  return {
    from: new Vector3(0, trolleyY, 0),
    to: new Vector3(0, 50, 0),
    node,
  };
}

/** 관 메쉬의 월드 위끝 y — 관 지오메트리 y=1 을 행렬로. */
function topY(mesh: Mesh): number {
  return new Vector3(0, 1, 0).applyMatrix4(mesh.matrix).y;
}

function ropeMeshes(parent: Group): Mesh[] {
  return parent.children as Mesh[];
}

describe('SceneRopeExtensions', () => {
  it('케이블마다 관 하나 — 모델 로프 재질을 빌리고 트롤리 높이까지 늘인다', () => {
    const parent = new Group();
    const ropes = new SceneRopeExtensions(parent);
    const { node, material } = ropeRig();
    expect(ropes.update([cable(node)])).toBe(true);
    const [mesh] = ropeMeshes(parent);
    expect(ropeMeshes(parent)).toHaveLength(1);
    expect(mesh.material).toBe(material);
    expect(mesh.visible).toBe(true);
    expect(topY(mesh)).toBeCloseTo(60);
    expect(new Vector3(0, 0, 0).applyMatrix4(mesh.matrix).y).toBeCloseTo(50);
  });

  it('두 번째 프레임은 다시 만들지 않고 같은 메쉬를 쓴다 — 권상이 내려가면 길어진다', () => {
    const parent = new Group();
    const ropes = new SceneRopeExtensions(parent);
    const { trolley, node } = ropeRig();
    ropes.update([cable(node)]);
    const [first] = ropeMeshes(parent);
    const geometry = first.geometry;
    node.position.y = -25; // 10 더 내림
    trolley.updateMatrixWorld(true);
    expect(ropes.update([cable(node)])).toBe(false);
    expect(ropeMeshes(parent)).toEqual([first]);
    expect(first.geometry).toBe(geometry);
    expect(new Vector3(0, 0, 0).applyMatrix4(first.matrix).y).toBeCloseTo(40);
    expect(topY(first)).toBeCloseTo(60);
  });

  it('노드 없는 케이블은 건너뛰고, 연장을 못 만드는 노드는 다시 시도하지 않는다', () => {
    const parent = new Group();
    const ropes = new SceneRopeExtensions(parent);
    const plate = new PlaneGeometry(2, 2);
    plate.rotateX(-Math.PI / 2);
    const { node } = ropeRig(plate);
    expect(ropes.update([cable(null), cable(node)])).toBe(true);
    expect(ropes.visibleCount).toBe(0);
    expect(ropes.update([cable(node)])).toBe(false);
    expect(ropeMeshes(parent)).toHaveLength(0);
  });

  it('윗끝이 트롤리 높이 이상이면(늘일 길이 없음) 숨긴다 — 경계 정확값도', () => {
    const parent = new Group();
    const ropes = new SceneRopeExtensions(parent);
    const { node } = ropeRig();
    ropes.update([cable(node, 50)]);
    expect(ropes.visibleCount).toBe(0);
    ropes.update([cable(node, 50.01)]);
    expect(ropes.visibleCount).toBe(1);
  });

  it('모델(조상)이 숨으면 숨기고, 다시 보이면 그린다', () => {
    const parent = new Group();
    const ropes = new SceneRopeExtensions(parent);
    const { trolley, node } = ropeRig();
    trolley.visible = false;
    ropes.update([cable(node)]);
    expect(ropes.visibleCount).toBe(0);
    trolley.visible = true;
    ropes.update([cable(node)]);
    expect(ropes.visibleCount).toBe(1);
  });

  it('케이블이 줄면 남는 관은 숨긴다', () => {
    const parent = new Group();
    const ropes = new SceneRopeExtensions(parent);
    const a = ropeRig();
    const b = ropeRig();
    ropes.update([cable(a.node), cable(b.node)]);
    expect(ropes.visibleCount).toBe(2);
    ropes.update([cable(a.node)]);
    expect(ropes.visibleCount).toBe(1);
    expect(ropeMeshes(parent)).toHaveLength(2);
    ropes.update([]);
    expect(ropes.visibleCount).toBe(0);
  });

  it('재질 배열이면 첫 재질, 그림자 설정은 원본 메쉬를 따른다', () => {
    const parent = new Group();
    const ropes = new SceneRopeExtensions(parent);
    const { node, mesh } = ropeRig();
    const first = new MeshStandardMaterial();
    mesh.material = [first, new MeshStandardMaterial()];
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    ropes.update([cable(node)]);
    const [ext] = ropeMeshes(parent);
    expect(ext.material).toBe(first);
    expect(ext.castShadow).toBe(true);
    expect(ext.receiveShadow).toBe(true);
  });

  it('레이캐스트에 잡히지 않는다', () => {
    const parent = new Group();
    const ropes = new SceneRopeExtensions(parent);
    const { node } = ropeRig();
    ropes.update([cable(node)]);
    parent.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(-5, 58, 0), new Vector3(1, 0, 0));
    expect(ray.intersectObject(parent, true)).toEqual([]);
  });

  it('dispose — 관을 떼고 관 지오메트리만 버린다(빌린 재질은 그대로)', () => {
    const parent = new Group();
    const ropes = new SceneRopeExtensions(parent);
    const { node, material } = ropeRig();
    ropes.update([cable(node)]);
    const [ext] = ropeMeshes(parent);
    let geometryDisposed = false;
    let materialDisposed = false;
    ext.geometry.addEventListener('dispose', () => {
      geometryDisposed = true;
    });
    material.addEventListener('dispose', () => {
      materialDisposed = true;
    });
    ropes.dispose();
    expect(parent.children).toHaveLength(0);
    expect(geometryDisposed).toBe(true);
    expect(materialDisposed).toBe(false);
    expect(ropes.visibleCount).toBe(0);
  });
});
