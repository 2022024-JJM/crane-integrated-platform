import { describe, expect, it } from 'vitest';
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  approxContactPoint,
  boxesSeparated,
  collectCollidableMeshes,
  hasBoundsTree,
  isCollidableMesh,
  meshesIntersectExact,
  meshesWithinDistance,
  meshObbsIntersect,
  meshWorldBox,
  SeparationQuery,
} from '../collision-volumes';

type BvhGeometry = BufferGeometry & { boundsTree?: MeshBVH };

function cube(size = 1): Mesh {
  return new Mesh(new BoxGeometry(size, size, size), new MeshBasicMaterial());
}

/** 위치·회전을 주고 matrixWorld 까지 갱신한 메쉬. */
function placed(
  mesh: Mesh,
  position: [number, number, number],
  rotationY = 0,
): Mesh {
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.updateMatrixWorld(true);
  return mesh;
}

function withBvh(mesh: Mesh): Mesh {
  (mesh.geometry as BvhGeometry).boundsTree = new MeshBVH(mesh.geometry);
  return mesh;
}

describe('isCollidableMesh / collectCollidableMeshes', () => {
  it('일반 메쉬는 대상이고, Group·빈 지오메트리·정점 없는 지오메트리는 아니다', () => {
    expect(isCollidableMesh(cube())).toBe(true);
    expect(isCollidableMesh(new Group())).toBe(false);
    expect(
      isCollidableMesh(new Mesh(new BufferGeometry(), new MeshBasicMaterial())),
    ).toBe(false);
  });

  it('drei Line(isLine2/isLineSegments2) 은 제외한다', () => {
    const line = cube() as Mesh & { isLineSegments2?: boolean };
    line.isLineSegments2 = true;
    expect(isCollidableMesh(line)).toBe(false);
  });

  it('boundingBox 가 없으면 계산해 두고 판정한다', () => {
    const mesh = cube();
    expect(mesh.geometry.boundingBox).toBeNull();
    expect(isCollidableMesh(mesh)).toBe(true);
    expect(mesh.geometry.boundingBox).not.toBeNull();
  });

  it('visible=false 서브트리는 수집에서 빠지고 out 배열은 재사용된다', () => {
    const root = new Object3D();
    const visible = cube();
    const hidden = new Group();
    hidden.visible = false;
    hidden.add(cube());
    root.add(visible, hidden);
    const out: Mesh[] = [cube()];
    const result = collectCollidableMeshes(root, out);
    expect(result).toBe(out);
    expect(out).toEqual([visible]);
  });

  it('root 자체가 숨겨져 있으면 아무것도 모으지 않는다', () => {
    const root = new Group();
    root.visible = false;
    root.add(cube());
    expect(collectCollidableMeshes(root, [])).toEqual([]);
  });

  it('LOD 는 가시성과 무관하게 LOD0 만 모은다 — LOD0 이 숨겨지고 LOD2 가 보여도', () => {
    const root = new Object3D();
    const lod0 = cube();
    lod0.userData = { lodGroup: 'a#0', lod: 0 };
    lod0.visible = false;
    const lod1 = cube();
    lod1.userData = { lodGroup: 'a#0', lod: 1 };
    lod1.visible = false;
    const lod2 = cube();
    lod2.userData = { lodGroup: 'a#0', lod: 2 };
    const plain = cube();
    root.add(lod0, plain, lod1, lod2);
    expect(collectCollidableMeshes(root, [])).toEqual([lod0, plain]);
  });

  it('다중 프리미티브 캐리어(Group + extras 가 복제된 자식 Mesh)도 LOD0 만 내려간다', () => {
    const root = new Object3D();
    const carrier0 = new Group();
    carrier0.userData = { lodGroup: 'b#0', lod: 0 };
    carrier0.visible = false;
    const prim0a = cube();
    prim0a.userData = { lodGroup: 'b#0', lod: 0 };
    const prim0b = cube();
    prim0b.userData = { lodGroup: 'b#0', lod: 0 };
    carrier0.add(prim0a, prim0b);
    const carrier1 = new Group();
    carrier1.userData = { lodGroup: 'b#0', lod: 1 };
    const prim1 = cube();
    prim1.userData = { lodGroup: 'b#0', lod: 1 };
    carrier1.add(prim1);
    root.add(carrier0, carrier1);
    expect(collectCollidableMeshes(root, [])).toEqual([prim0a, prim0b]);
  });

  it('숨겨진 일반 Group 아래의 LOD0 은 빠진다(사용자 숨김 존중)', () => {
    const root = new Object3D();
    const hidden = new Group();
    hidden.visible = false;
    const lod0 = cube();
    lod0.userData = { lodGroup: 'c#0', lod: 0 };
    hidden.add(lod0);
    root.add(hidden);
    expect(collectCollidableMeshes(root, [])).toEqual([]);
  });

  it('오염된 lod(문자열·NaN·Infinity)는 일반 노드로 본다 — 보이면 수집, 숨기면 제외', () => {
    const root = new Object3D();
    const text = cube();
    text.userData = { lod: '2' };
    const nan = cube();
    nan.userData = { lod: Number.NaN };
    const inf = cube();
    inf.userData = { lod: Number.POSITIVE_INFINITY };
    const hiddenText = cube();
    hiddenText.userData = { lod: '0' };
    hiddenText.visible = false;
    root.add(text, nan, inf, hiddenText);
    expect(collectCollidableMeshes(root, [])).toEqual([text, nan, inf]);
  });
});

describe('meshWorldBox', () => {
  it('matrixWorld 를 반영한 월드 AABB 를 target 에 쓴다(참조 유지)', () => {
    const mesh = placed(cube(2), [10, 0, 0]);
    const target = new Box3();
    expect(meshWorldBox(mesh, target)).toBe(target);
    expect(target.min.x).toBeCloseTo(9);
    expect(target.max.x).toBeCloseTo(11);
  });
});

describe('meshObbsIntersect', () => {
  it('겹치면 true, 떨어지면 false', () => {
    expect(
      meshObbsIntersect(placed(cube(), [0, 0, 0]), placed(cube(), [0.5, 0, 0])),
    ).toBe(true);
    expect(
      meshObbsIntersect(placed(cube(), [0, 0, 0]), placed(cube(), [3, 0, 0])),
    ).toBe(false);
  });

  it('margin 을 주면 그만큼 떨어진 쌍도 겹친 것으로 본다(간격 = margin 은 겹침, 그보다 크면 분리)', () => {
    const a = placed(cube(), [0, 0, 0]);
    expect(meshObbsIntersect(a, placed(cube(), [1.05, 0, 0]))).toBe(false);
    expect(meshObbsIntersect(a, placed(cube(), [1.05, 0, 0]), 0.05)).toBe(true);
    expect(meshObbsIntersect(a, placed(cube(), [1.06, 0, 0]), 0.05)).toBe(
      false,
    );
    // 음수·NaN margin 은 0 으로 본다.
    expect(meshObbsIntersect(a, placed(cube(), [1.05, 0, 0]), -1)).toBe(false);
    expect(meshObbsIntersect(a, placed(cube(), [1.05, 0, 0]), Number.NaN)).toBe(
      false,
    );
  });

  it('45° 회전한 얇은 판 — AABB 는 겹치지만 OBB 는 겹치지 않는다', () => {
    // 길이 4, 두께 0.1 판을 Y축 +45° 회전하면 판은 x = -z 대각선에 놓인다.
    // AABB 는 ±1.45 로 부풀어 (1.2, 0, 1.2) 의 작은 큐브와 겹치지만, 그 점은
    // 판의 수직 방향으로 1.7 떨어져 있어 실제 판은 지나지 않는다.
    const plank = new Mesh(new BoxGeometry(4, 1, 0.1), new MeshBasicMaterial());
    placed(plank, [0, 0, 0], Math.PI / 4);
    const small = placed(cube(0.4), [1.2, 0, 1.2]);
    const boxA = meshWorldBox(plank, new Box3());
    const boxB = meshWorldBox(small, new Box3());
    expect(boxA.intersectsBox(boxB)).toBe(true);
    expect(meshObbsIntersect(plank, small)).toBe(false);
  });
});

describe('meshesIntersectExact', () => {
  it('양쪽 BVH 가 있으면 관통 true / 분리 false', () => {
    const a = withBvh(placed(cube(), [0, 0, 0]));
    const b = withBvh(placed(cube(), [0.5, 0.5, 0]));
    const c = withBvh(placed(cube(), [5, 0, 0]));
    expect(hasBoundsTree(a)).toBe(true);
    expect(meshesIntersectExact(a, b)).toBe(true);
    expect(meshesIntersectExact(a, c)).toBe(false);
  });

  it('AABB 는 겹치지만 삼각형은 닿지 않는 배치는 false', () => {
    // 큐브를 Y축 45° 돌리면 AABB 가 ±0.707 로 부푼다. 그 모서리 밖 (0.75, 0, 0.75)
    // 부근의 작은 큐브는 AABB 와는 겹치지만 회전한 큐브 본체와는 닿지 않는다.
    const rotated = withBvh(placed(cube(), [0, 0, 0], Math.PI / 4));
    const corner = withBvh(placed(cube(0.1), [0.65, 0, 0.65]));
    expect(
      meshWorldBox(rotated, new Box3()).intersectsBox(
        meshWorldBox(corner, new Box3()),
      ),
    ).toBe(true);
    expect(meshesIntersectExact(rotated, corner)).toBe(false);
  });

  it('한쪽이라도 BVH 가 없으면 null(판정 불가)', () => {
    const a = withBvh(placed(cube(), [0, 0, 0]));
    const b = placed(cube(), [0.5, 0, 0]);
    expect(meshesIntersectExact(a, b)).toBeNull();
    expect(meshesIntersectExact(b, a)).toBeNull();
    expect(meshesIntersectExact(b, placed(cube(), [0, 0, 0]))).toBeNull();
  });

  it('축소 스케일 노드(부모 scale)도 월드 기준으로 판정한다', () => {
    const parent = new Group();
    parent.scale.setScalar(0.1);
    const a = withBvh(cube());
    parent.add(a);
    parent.updateMatrixWorld(true);
    // 부모 0.1 배 → a 는 ±0.05. (0.2, 0, 0) 의 0.1 큐브(±0.05)와는 떨어져 있다.
    const b = withBvh(placed(cube(0.1), [0.2, 0, 0]));
    expect(meshesIntersectExact(a, b)).toBe(false);
    const c = withBvh(placed(cube(0.1), [0.08, 0, 0]));
    expect(meshesIntersectExact(a, c)).toBe(true);
  });
});

describe('meshesWithinDistance', () => {
  it('삼각형 최단 거리가 한계 이하면 true(정확값 포함), 넘으면 false', () => {
    const a = withBvh(placed(cube(), [0, 0, 0]));
    expect(
      meshesWithinDistance(a, withBvh(placed(cube(), [1.03, 0, 0])), 0.05),
    ).toBe(true);
    expect(
      meshesWithinDistance(a, withBvh(placed(cube(), [1.05, 0, 0])), 0.05),
    ).toBe(true);
    expect(
      meshesWithinDistance(a, withBvh(placed(cube(), [1.06, 0, 0])), 0.05),
    ).toBe(false);
    // 관통 중이면 거리 0 → true
    expect(
      meshesWithinDistance(a, withBvh(placed(cube(), [0.5, 0, 0])), 0.05),
    ).toBe(true);
  });

  it('OBB·AABB 는 겹치지만 삼각형은 먼 배치(큰 상자 안의 작은 상자, 회전 판)는 false', () => {
    const big = withBvh(placed(cube(4), [0, 0, 0]));
    const inside = withBvh(placed(cube(0.5), [0, 0, 0]));
    expect(meshObbsIntersect(big, inside)).toBe(true);
    expect(meshesWithinDistance(big, inside, 0.05)).toBe(false);

    const plank = new Mesh(new BoxGeometry(4, 1, 0.1), new MeshBasicMaterial());
    withBvh(placed(plank, [0, 0, 0], Math.PI / 4));
    const small = withBvh(placed(cube(0.4), [1.2, 0, 1.2]));
    expect(meshesWithinDistance(plank, small, 0.05)).toBe(false);
  });

  it('한쪽이라도 BVH 가 없으면 null, 한계가 0·음수·NaN 이면 접촉(거리 0)만 true', () => {
    const a = withBvh(placed(cube(), [0, 0, 0]));
    expect(
      meshesWithinDistance(a, placed(cube(), [0.5, 0, 0]), 0.05),
    ).toBeNull();
    const touching = withBvh(placed(cube(), [1, 0, 0]));
    expect(meshesWithinDistance(a, touching, 0)).toBe(true);
    expect(meshesWithinDistance(a, touching, -1)).toBe(true);
    expect(
      meshesWithinDistance(
        a,
        withBvh(placed(cube(), [1.001, 0, 0])),
        Number.NaN,
      ),
    ).toBe(false);
  });
});

describe('SeparationQuery', () => {
  const clock = () => 0;
  /** 예산을 넉넉히 줘 한 번에 끝낸 답. */
  const resolve = (a: Mesh, b: Mesh, margin: number) => {
    const q = new SeparationQuery();
    if (!q.begin(a, b, margin)) return null;
    let r = q.step(Number.POSITIVE_INFINITY, clock);
    while (r === 'pending') r = q.step(Number.POSITIVE_INFINITY, clock);
    return r;
  };

  it('meshesWithinDistance 와 같은 답 — 한계 이하(정확값 포함) near, 넘으면 separated, 관통은 near', () => {
    const a = withBvh(placed(cube(), [0, 0, 0]));
    expect(resolve(a, withBvh(placed(cube(), [1.03, 0, 0])), 0.05)).toBe('near');
    expect(resolve(a, withBvh(placed(cube(), [1.05, 0, 0])), 0.05)).toBe('near');
    expect(resolve(a, withBvh(placed(cube(), [1.06, 0, 0])), 0.05)).toBe(
      'separated',
    );
    expect(resolve(a, withBvh(placed(cube(), [0.5, 0, 0])), 0.05)).toBe('near');
  });

  it('OBB·AABB 는 겹치지만 삼각형은 먼 배치(큰 상자 안의 작은 상자, 회전 판)는 separated', () => {
    const big = withBvh(placed(cube(4), [0, 0, 0]));
    const inside = withBvh(placed(cube(0.5), [0, 0, 0]));
    expect(resolve(big, inside, 0.05)).toBe('separated');
    expect(resolve(inside, big, 0.05)).toBe('separated');
    const plank = new Mesh(new BoxGeometry(4, 1, 0.1), new MeshBasicMaterial());
    withBvh(placed(plank, [0, 0, 0], Math.PI / 4));
    const small = withBvh(placed(cube(0.4), [1.2, 0, 1.2]));
    expect(resolve(plank, small, 0.05)).toBe('separated');
    expect(resolve(small, plank, 0.05)).toBe('separated');
  });

  it('한쪽이라도 BVH 가 없으면 begin 이 false, 한계 0·음수·NaN 은 접촉(거리 0)만 near', () => {
    const a = withBvh(placed(cube(), [0, 0, 0]));
    const q = new SeparationQuery();
    expect(q.begin(a, placed(cube(), [0.5, 0, 0]), 0.05)).toBe(false);
    expect(q.active).toBe(false);
    const touching = withBvh(placed(cube(), [1, 0, 0]));
    expect(resolve(a, touching, 0)).toBe('near');
    expect(resolve(a, touching, -1)).toBe('near');
    expect(resolve(a, withBvh(placed(cube(), [1.001, 0, 0])), Number.NaN)).toBe(
      'separated',
    );
  });

  /** 속이 빈 상대 — 정육면체 둘을 x=±2 에 합친 지오메트리. 경계 박스는 넓고 가운데는 비었다. */
  function hollow(): Mesh {
    const left = new BoxGeometry(1, 1, 1).translate(-2, 0, 0);
    const right = new BoxGeometry(1, 1, 1).translate(2, 0, 0);
    return new Mesh(mergeGeometries([left, right])!, new MeshBasicMaterial());
  }

  it('예산 0 이면 step 마다 리프 하나만 보고 pending — 이어서 끝까지 가면 같은 답, 끝나면 비활성', () => {
    const fine = new Mesh(new BoxGeometry(1, 1, 1, 4, 4, 4), new MeshBasicMaterial());
    const a = withBvh(placed(fine, [0, 0, 0]));
    const b = withBvh(placed(hollow(), [0, 0, 0]));
    const q = new SeparationQuery();
    expect(q.begin(a, b, 0.05)).toBe(true);
    expect(q.active).toBe(true);
    let steps = 0;
    let r = q.step(0, clock);
    while (r === 'pending') {
      steps += 1;
      expect(q.active).toBe(true);
      r = q.step(0, clock);
    }
    expect(r).toBe('separated');
    expect(steps).toBeGreaterThan(1);
    expect(q.active).toBe(false);
    // 같은 인스턴스를 다시 열어 near 도 조기 종료로 끝난다.
    expect(q.begin(a, withBvh(placed(cube(), [1.02, 0, 0])), 0.05)).toBe(true);
    r = q.step(0, clock);
    while (r === 'pending') r = q.step(0, clock);
    expect(r).toBe('near');
  });

  it('진행 중 상대가 움직이면 다음 step 은 현재 자세로 본다', () => {
    const fine = new Mesh(new BoxGeometry(1, 1, 1, 4, 4, 4), new MeshBasicMaterial());
    const a = withBvh(placed(fine, [0, 0, 0]));
    const b = withBvh(placed(hollow(), [0, 0, 0]));
    const q = new SeparationQuery();
    q.begin(a, b, 0.05);
    expect(q.step(0, clock)).toBe('pending');
    // 왼쪽 정육면체(-2.5..-1.5)가 A(-0.5..0.5) 에 닿도록.
    placed(b, [1.98, 0, 0]);
    let r = q.step(0, clock);
    while (r === 'pending') r = q.step(0, clock);
    expect(r).toBe('near');
  });

  it('reset 은 진행 중 질의를 버리고 step 은 separated 를 돌려준다', () => {
    const a = withBvh(placed(cube(), [0, 0, 0]));
    const q = new SeparationQuery();
    q.begin(a, withBvh(placed(cube(), [0.5, 0, 0])), 0.05);
    q.reset();
    expect(q.active).toBe(false);
    expect(q.step(0, clock)).toBe('separated');
  });
});

describe('approxContactPoint', () => {
  it('교집합 박스의 중심을 target 에 쓴다(참조 유지)', () => {
    const a = placed(cube(2), [0, 0, 0]);
    const b = placed(cube(2), [1, 0, 0]);
    const target = new Vector3();
    expect(approxContactPoint(a, b, target)).toBe(target);
    // 교집합 x ∈ [0, 1] → 중심 0.5
    expect(target.x).toBeCloseTo(0.5);
    expect(target.y).toBeCloseTo(0);
  });

  it('교집합이 비면 두 중심의 중점으로 폴백한다', () => {
    const a = placed(cube(), [0, 0, 0]);
    const b = placed(cube(), [4, 0, 0]);
    const p = approxContactPoint(a, b, new Vector3());
    expect(p.x).toBeCloseTo(2);
  });
});

describe('boxesSeparated', () => {
  const a = new Box3(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
  const gap = (g: number) =>
    new Box3(new Vector3(1 + g, 0, 0), new Vector3(2 + g, 1, 1));

  it('간격이 margin 과 정확히 같으면 아직 붙어 있고, 조금이라도 크면 떨어진 것', () => {
    expect(boxesSeparated(a, gap(0.05), 0.05)).toBe(false);
    expect(boxesSeparated(a, gap(0.05 + 1e-9), 0.05)).toBe(true);
  });

  it('겹친 박스는 어떤 margin 에도 false, 겹치지 않아도 margin 안이면 false', () => {
    expect(boxesSeparated(a, gap(-0.5), 0)).toBe(false);
    expect(boxesSeparated(a, gap(0.01), 0.05)).toBe(false);
  });

  it('margin 0 이면 간격 > 0 에서 true, 음수·NaN margin 은 0 으로 본다', () => {
    expect(boxesSeparated(a, gap(1e-6), 0)).toBe(true);
    expect(boxesSeparated(a, gap(1e-6), -1)).toBe(true);
    expect(boxesSeparated(a, gap(1e-6), Number.NaN)).toBe(true);
  });

  it('한 축만 떨어져 있어도 분리다', () => {
    const above = new Box3(new Vector3(0, 2, 0), new Vector3(1, 3, 1));
    expect(boxesSeparated(a, above, 0.5)).toBe(true);
  });
});
