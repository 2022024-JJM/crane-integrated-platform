import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  buildStrandExtension,
  cableLength,
  computeCableSegment,
  computeHookAnchor,
  computeStrandExtensionMatrix,
  isAttachOn,
  isWorldVisible,
  measureHookNode,
  pickNearestCandidate,
  type HookNodeExtent,
} from '../scene-carry';

function extent(): HookNodeExtent {
  return { origin: new Vector3(), top: 0, bottom: 0 };
}

/** 트롤리(부모) 아래 훅 블록(2 unit 높이 박스) — 노드 원점은 박스 위 1 unit. */
function hookRig() {
  const trolley = new Group();
  trolley.position.set(10, 60, 5);
  const node = new Group();
  node.position.set(0, -20, 0);
  const block = new Mesh(new BoxGeometry(2, 2, 2));
  block.position.set(0, -2, 0);
  node.add(block);
  trolley.add(node);
  trolley.updateMatrixWorld(true);
  return { trolley, node };
}

describe('isAttachOn', () => {
  it('0.5 이상만 켜짐, undefined·NaN 은 꺼짐', () => {
    expect(isAttachOn(1)).toBe(true);
    expect(isAttachOn(0.5)).toBe(true);
    expect(isAttachOn(0.49)).toBe(false);
    expect(isAttachOn(0)).toBe(false);
    expect(isAttachOn(undefined)).toBe(false);
    expect(isAttachOn(Number.NaN)).toBe(false);
  });
});

describe('measureHookNode', () => {
  it('노드 서브트리의 월드 위·아래 y 와 원점을 잰다', () => {
    const { node } = hookRig();
    const out = extent();
    measureHookNode(node, out);
    expect(out.origin.toArray()).toEqual([10, 40, 5]);
    expect(out.top).toBeCloseTo(39);
    expect(out.bottom).toBeCloseTo(37);
  });

  it('지오메트리가 없는 Empty 는 원점이 곧 위·아래', () => {
    const node = new Group();
    node.position.set(1, 2, 3);
    node.updateMatrixWorld(true);
    const out = extent();
    measureHookNode(node, out);
    expect(out.top).toBe(2);
    expect(out.bottom).toBe(2);
  });

  it('부모가 이 프레임에 움직였어도(matrixWorld 미갱신) 현재 자세로 잰다', () => {
    const { trolley, node } = hookRig();
    trolley.position.y = 50; // updateMatrixWorld 를 부르지 않는다
    const out = extent();
    measureHookNode(node, out);
    expect(out.origin.y).toBe(30);
    expect(out.bottom).toBeCloseTo(27);
  });
});

describe('computeHookAnchor', () => {
  it('XZ 는 평균, y 는 가장 낮은 바닥 + 오프셋', () => {
    const a = extent();
    a.origin.set(0, 50, 10);
    a.bottom = 45;
    const b = extent();
    b.origin.set(4, 50, -10);
    b.bottom = 44;
    const out = computeHookAnchor([a, b], -1, new Vector3());
    expect(out.toArray()).toEqual([2, 43, 0]);
  });

  it('노드가 없으면 원점', () => {
    expect(computeHookAnchor([], 5, new Vector3(1, 1, 1)).toArray()).toEqual([
      0, 0, 0,
    ]);
  });
});

describe('pickNearestCandidate', () => {
  const anchor = new Vector3(0, 100, 0);
  const near = { id: 'near', position: new Vector3(3, 0, 4) }; // 5
  const far = { id: 'far', position: new Vector3(0, 0, 11) }; // 11
  const edge = { id: 'edge', position: new Vector3(10, 0, 0) }; // 10

  it('반경 안에서 가장 가까운 것, 높이는 무시', () => {
    expect(pickNearestCandidate(anchor, [far, near], 10)).toBe(near);
  });

  it('반경 경계 정확값은 포함, 그 밖은 제외', () => {
    expect(pickNearestCandidate(anchor, [edge], 10)).toBe(edge);
    expect(pickNearestCandidate(anchor, [edge], 9.999)).toBeNull();
  });

  it('후보가 없거나 반경이 0·음수·NaN 이면 null', () => {
    expect(pickNearestCandidate(anchor, [], 10)).toBeNull();
    expect(pickNearestCandidate(anchor, [near], 0)).toBeNull();
    expect(pickNearestCandidate(anchor, [near], -1)).toBeNull();
    expect(pickNearestCandidate(anchor, [near], Number.NaN)).toBeNull();
  });

  it('같은 거리면 앞 항목', () => {
    const a = { id: 'a', position: new Vector3(5, 0, 0) };
    const b = { id: 'b', position: new Vector3(-5, 0, 0) };
    expect(pickNearestCandidate(anchor, [a, b], 10)).toBe(a);
  });
});

describe('computeCableSegment / cableLength', () => {
  it('부모 높이에서 노드 꼭대기까지 수직선', () => {
    const { node } = hookRig();
    const e = extent();
    measureHookNode(node, e);
    const seg = computeCableSegment(node, e, {
      from: new Vector3(),
      to: new Vector3(),
      node: null,
    });
    expect(seg.node).toBe(node);
    expect(seg.from.toArray()).toEqual([10, 60, 5]);
    expect(seg.to.toArray()).toEqual([10, 39, 5]);
    expect(cableLength(seg)).toBeCloseTo(21);
  });

  it('부모가 없으면 길이 0', () => {
    const node = new Group();
    const e = extent();
    measureHookNode(node, e);
    const seg = computeCableSegment(node, e, {
      from: new Vector3(),
      to: new Vector3(),
      node: null,
    });
    expect(cableLength(seg)).toBe(0);
  });

  it('꼭대기가 부모보다 높으면 0 (음수 길이 없음)', () => {
    expect(
      cableLength({
        from: new Vector3(0, 1, 0),
        to: new Vector3(0, 5, 0),
        node: null,
      }),
    ).toBe(0);
  });
});

/** 세로 로프 한 가닥(반지름 r, 길이 h) — 아래끝이 y=bottom, x·z 중심. */
function strand(r: number, h: number, x: number, z: number, bottom = 0) {
  const g = new CylinderGeometry(r, r, h, 8);
  g.translate(x, bottom + h / 2, z);
  return g;
}

/** 관 지오메트리의 정점 목록 [x, y, z][]. */
function vertices(geometry: BufferGeometry): number[][] {
  const p = geometry.getAttribute('position');
  return Array.from({ length: p.count }, (_, i) => [
    p.getX(i),
    p.getY(i),
    p.getZ(i),
  ]);
}

/** 삼각형마다 면 법선이 가닥 중심(cx, cz)에서 바깥을 향하는가. */
function facesOutward(geometry: BufferGeometry, cx: number, cz: number) {
  const v = vertices(geometry).map(([x, y, z]) => new Vector3(x, y, z));
  for (let i = 0; i < v.length; i += 3) {
    const n = new Vector3()
      .subVectors(v[i + 1], v[i])
      .cross(new Vector3().subVectors(v[i + 2], v[i]));
    const mid = new Vector3()
      .add(v[i])
      .add(v[i + 1])
      .add(v[i + 2])
      .divideScalar(3);
    const radial = new Vector3(mid.x - cx, 0, mid.z - cz);
    if (n.dot(radial) <= 0) return false;
  }
  return true;
}

/** 트롤리(부모) 아래 로프 노드 — 노드는 배율·위치가 있고 메쉬를 자식으로 든다. */
function ropeRig(geometry: BufferGeometry) {
  const trolley = new Group();
  trolley.position.set(100, 60, -20);
  const node = new Group();
  node.position.set(0, -15, 0);
  node.scale.setScalar(2);
  const mesh = new Mesh(geometry, new MeshStandardMaterial());
  node.add(mesh);
  trolley.add(node);
  trolley.updateMatrixWorld(true);
  return { trolley, node, mesh };
}

describe('buildStrandExtension', () => {
  it('가닥 윗끝 단면을 위로 뽑는다 — 옆면 한 칸에 사각형 하나, 바깥을 향한다', () => {
    // 노드 로컬: 가닥 y 0~5, 윗끝 5.
    const { node, mesh } = ropeRig(strand(0.1, 5, 0.5, 0));
    const ext = buildStrandExtension(node);
    expect(ext).not.toBeNull();
    expect(ext!.source).toBe(mesh);
    expect(ext!.baseY).toBeCloseTo(5);
    const v = vertices(ext!.geometry);
    expect(v).toHaveLength(8 * 6); // 반경 분할 8 × 삼각형 둘
    for (const [x, y, z] of v) {
      expect([0, 1]).toContain(y);
      expect(Math.hypot(x - 0.5, z)).toBeCloseTo(0.1);
    }
    expect(facesOutward(ext!.geometry, 0.5, 0)).toBe(true);
    const n = ext!.geometry.getAttribute('normal');
    for (let i = 0; i < n.count; i += 1) expect(n.getY(i)).toBe(0);
  });

  it('가장 높은 가닥들만 — 윗끝이 낮은 가닥(훅 아래 슬링)은 뽑지 않는다', () => {
    const merged = mergeGeometries([
      strand(0.1, 5, -1, 0), // 위 로프 둘
      strand(0.1, 5, 1, 0),
      strand(0.1, 3, 0, 0, -4), // 아래 슬링, 윗끝 -1
    ])!;
    const { node } = ropeRig(merged);
    const v = vertices(buildStrandExtension(node)!.geometry);
    expect(v).toHaveLength(2 * 8 * 6);
    expect(v.every(([x]) => Math.abs(Math.abs(x) - 1) <= 0.1 + 1e-6)).toBe(
      true,
    );
  });

  it('메쉬가 여럿이면 가장 높은 정점을 가진 메쉬가 원본 — 재질을 그 메쉬에서', () => {
    const { node, mesh } = ropeRig(strand(0.1, 5, 0, 0));
    const hookBlock = new Mesh(new BoxGeometry(1, 1, 1));
    hookBlock.position.y = -0.5;
    node.add(hookBlock);
    node.updateMatrixWorld(true);
    expect(buildStrandExtension(node)!.source).toBe(mesh);
  });

  it('자식 메쉬의 위치·배율을 노드 로컬로 옮겨 잰다', () => {
    const { node, mesh } = ropeRig(strand(0.1, 5, 0, 0));
    mesh.position.set(0.2, 1, 0);
    mesh.scale.setScalar(0.5);
    node.updateMatrixWorld(true);
    const ext = buildStrandExtension(node)!;
    expect(ext.baseY).toBeCloseTo(1 + 2.5);
    for (const [x, , z] of vertices(ext.geometry)) {
      expect(Math.hypot(x - 0.2, z)).toBeCloseTo(0.05);
    }
  });

  it('양자화(int16 정규화) 위치도 풀어서 읽는다', () => {
    const src = strand(0.1, 1.8, 0.4, 0, -0.9); // 정규화 범위 [-1, 1] 안
    const p = src.getAttribute('position');
    const quantized = new Int16Array(p.count * 3);
    for (let i = 0; i < p.array.length; i += 1) {
      quantized[i] = Math.round(p.array[i] * 32767);
    }
    src.setAttribute('position', new BufferAttribute(quantized, 3, true));
    const ext = buildStrandExtension(ropeRig(src).node)!;
    expect(ext.baseY).toBeCloseTo(0.9, 3);
    for (const [x, , z] of vertices(ext.geometry)) {
      expect(Math.hypot(x - 0.4, z)).toBeCloseTo(0.1, 3);
    }
  });

  it('인덱스 없는 지오메트리도 같은 결과', () => {
    const indexed = buildStrandExtension(ropeRig(strand(0.1, 5, 0, 0)).node)!;
    const flat = buildStrandExtension(
      ropeRig(strand(0.1, 5, 0, 0).toNonIndexed()).node,
    )!;
    expect(vertices(flat.geometry)).toHaveLength(
      vertices(indexed.geometry).length,
    );
    expect(facesOutward(flat.geometry, 0, 0)).toBe(true);
  });

  it('법선이 없거나 수평 성분이 0 이면 면 법선(바깥)으로', () => {
    const noNormal = strand(0.1, 5, 0, 0);
    noNormal.deleteAttribute('normal');
    const up = strand(0.1, 5, 0, 0);
    const n = up.getAttribute('normal');
    for (let i = 0; i < n.count; i += 1) n.setXYZ(i, 0, 1, 0);
    for (const geometry of [noNormal, up]) {
      const ext = buildStrandExtension(ropeRig(geometry).node)!;
      const normals = ext.geometry.getAttribute('normal');
      const pos = ext.geometry.getAttribute('position');
      for (let i = 0; i < normals.count; i += 1) {
        const radial = new Vector3(pos.getX(i), 0, pos.getZ(i));
        const normal = new Vector3(normals.getX(i), 0, normals.getZ(i));
        expect(normal.length()).toBeCloseTo(1);
        expect(normal.dot(radial)).toBeGreaterThan(0);
      }
    }
  });

  it('UV 가 있으면 윗끝 정점의 UV 를 위·아래에 그대로, 없으면 속성 없음', () => {
    const withUv = buildStrandExtension(ropeRig(strand(0.1, 5, 0, 0)).node)!;
    expect(withUv.geometry.getAttribute('uv').count).toBe(8 * 6);
    const plain = strand(0.1, 5, 0, 0);
    plain.deleteAttribute('uv');
    const noUv = buildStrandExtension(ropeRig(plain).node)!;
    expect(noUv.geometry.getAttribute('uv')).toBeUndefined();
  });

  it('꼭대기가 판뿐이면(옆면 없음) null', () => {
    const plate = new PlaneGeometry(2, 2);
    plate.rotateX(-Math.PI / 2);
    expect(buildStrandExtension(ropeRig(plate).node)).toBeNull();
  });

  it('메쉬가 없거나 정점이 없으면 null', () => {
    const empty = new Group();
    empty.updateMatrixWorld(true);
    expect(buildStrandExtension(empty)).toBeNull();
    expect(buildStrandExtension(ropeRig(new BufferGeometry()).node)).toBeNull();
  });
});

describe('computeStrandExtensionMatrix', () => {
  /** 관의 아래(y=0)·위(y=1) 점을 월드로. */
  function ends(matrix: Matrix4, x = 0, z = 0) {
    return [
      new Vector3(x, 0, z).applyMatrix4(matrix),
      new Vector3(x, 1, z).applyMatrix4(matrix),
    ];
  }

  it('가닥 윗끝(월드)에서 트롤리 높이까지 늘인다 — 노드 위치·배율을 따른다', () => {
    const { node } = ropeRig(strand(0.1, 5, 0, 0));
    // 노드 월드: 원점 y 45, 배율 2 → 윗끝(로컬 5) 은 월드 55.
    const out = new Matrix4();
    expect(computeStrandExtensionMatrix(node, 5, 60, out)).toBe(true);
    const [bottom, top] = ends(out, 0.5, 0);
    expect(bottom.toArray()).toEqual([101, 55, -20]);
    expect(top.y).toBeCloseTo(60);
    expect(top.x).toBeCloseTo(101);
  });

  it('노드의 y 축 회전을 따른다(가닥 배치가 돌아간다)', () => {
    const { node } = ropeRig(strand(0.1, 5, 0, 0));
    node.rotation.y = Math.PI / 2;
    node.updateMatrixWorld(true);
    const out = new Matrix4();
    computeStrandExtensionMatrix(node, 5, 60, out);
    const [bottom] = ends(out, 0.5, 0);
    expect(bottom.x).toBeCloseTo(100);
    expect(bottom.z).toBeCloseTo(-21);
  });

  it('늘일 길이가 없으면 false — 경계(윗끝 = 트롤리)도 false', () => {
    const { node } = ropeRig(strand(0.1, 5, 0, 0));
    const out = new Matrix4();
    expect(computeStrandExtensionMatrix(node, 5, 55, out)).toBe(false);
    expect(computeStrandExtensionMatrix(node, 5, 55.001, out)).toBe(true);
    expect(computeStrandExtensionMatrix(node, 5, 40, out)).toBe(false);
    expect(computeStrandExtensionMatrix(node, 5, Number.NaN, out)).toBe(false);
  });

  it('노드 위쪽이 월드 위를 향하지 않으면(뒤집힘) false', () => {
    const { node } = ropeRig(strand(0.1, 5, 0, 0));
    node.rotation.x = Math.PI;
    node.updateMatrixWorld(true);
    expect(computeStrandExtensionMatrix(node, 5, 100, new Matrix4())).toBe(
      false,
    );
  });
});

describe('isWorldVisible', () => {
  it('조상 하나라도 숨으면 false', () => {
    const { trolley, mesh } = ropeRig(strand(0.1, 5, 0, 0));
    expect(isWorldVisible(mesh)).toBe(true);
    trolley.visible = false;
    expect(isWorldVisible(mesh)).toBe(false);
    trolley.visible = true;
    mesh.visible = false;
    expect(isWorldVisible(mesh)).toBe(false);
  });
});
