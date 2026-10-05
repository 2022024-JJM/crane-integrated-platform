import {
  Bone,
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  Texture,
  Uint16BufferAttribute,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { describe, expect, it } from 'vitest';
import {
  computeObjectStats,
  computeRenderBounds,
  getLodLevel,
  isInsideLodCopy,
} from '../model-geometry-stats';

/** 1×1×1 상자 — 삼각형 12, 정점 24. */
function box(material: Material = new MeshBasicMaterial()) {
  return new Mesh(new BoxGeometry(1, 1, 1), material);
}

function texture(width: number, height: number) {
  const tex = new Texture();
  tex.image = { width, height };
  return tex;
}

/**
 * 모든 정점을 뼈에 묶은 스킨 메쉬. `weights` 는 뼈 순서대로의 가중치다(최대 4).
 * GLTFLoader 처럼 항등 바인드 행렬로 묶는다 — 바인드 역행렬은 처음
 * `updateMatrixWorld` 가 돌 때까지 항등으로 남는다.
 */
function skinned(
  geometry: BufferGeometry,
  bones: Bone[],
  boneInverses: Matrix4[],
  weights: number[] = [1],
) {
  const count = geometry.getAttribute('position').count;
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  for (let i = 0; i < count; i += 1) {
    for (let slot = 0; slot < 4; slot += 1) {
      skinIndex.push(slot < weights.length ? slot : 0);
      skinWeight.push(weights[slot] ?? 0);
    }
  }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute(
    'skinWeight',
    new Float32BufferAttribute(skinWeight, 4),
  );
  const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial());
  mesh.bind(new Skeleton(bones, boneInverses), new Matrix4());
  return mesh;
}

/**
 * 사람 GLB 와 같은 짜임 — 축소 배율이 걸린 뼈대 루트 아래에 스킨 메쉬와 뼈가
 * 형제로 놓이고, 정점은 ±1 로 양자화돼 복원 변환이 역바인드 행렬에 들어 있다.
 * 그려지는 몸은 x ±0.25, y 0–1.8, z ±0.15 다.
 */
function quantizedPerson() {
  const armature = new Group();
  armature.scale.setScalar(0.01);
  const bone = new Bone();
  armature.add(bone);
  armature.updateMatrixWorld(true);
  const dequantize = new Matrix4().compose(
    new Vector3(0, 0.9, 0),
    new Quaternion(),
    new Vector3(0.25, 0.9, 0.15),
  );
  const inverseBind = bone.matrixWorld.clone().invert().multiply(dequantize);
  const mesh = skinned(new BoxGeometry(2, 2, 2), [bone], [inverseBind]);
  armature.add(mesh);
  return { armature, bone, mesh };
}

function expectBounds(
  root: Group,
  min: [number, number, number],
  max: [number, number, number],
) {
  const bounds = computeRenderBounds(root);
  for (let axis = 0; axis < 3; axis += 1) {
    expect(bounds.min.getComponent(axis)).toBeCloseTo(min[axis], 5);
    expect(bounds.max.getComponent(axis)).toBeCloseTo(max[axis], 5);
  }
}

describe('computeObjectStats', () => {
  it('빈 씬은 0 과 크기 null 을 낸다', () => {
    expect(computeObjectStats(new Group())).toEqual({
      triangles: 0,
      vertices: 0,
      meshes: 0,
      materials: 0,
      textures: 0,
      drawCalls: 0,
      nodes: 1,
      textureMemoryBytes: 0,
      size: null,
      lodLevels: 1,
      animations: 0,
    });
  });

  it('메쉬·삼각형·드로우콜·노드를 센다', () => {
    const root = new Group();
    root.add(box(), box());
    const stats = computeObjectStats(root, 2);
    expect(stats).toMatchObject({
      triangles: 24,
      meshes: 2,
      drawCalls: 2,
      nodes: 3,
      materials: 2,
      animations: 2,
    });
  });

  it('지오메트리·머티리얼을 공유하면 고유 개수는 한 번만 센다', () => {
    const shared = box();
    const second = new Mesh(shared.geometry, shared.material);
    const root = new Group();
    root.add(shared, second);
    const stats = computeObjectStats(root);
    // 렌더 삼각형은 인스턴스마다, 정점(상주 버퍼)은 한 번.
    expect(stats.triangles).toBe(24);
    expect(stats.vertices).toBe(24);
    expect(stats.materials).toBe(1);
  });

  it('LOD 사본(lod > 0)은 렌더 기준에서 빼되 단계 수에는 반영한다', () => {
    const root = new Group();
    const lod0 = box();
    lod0.userData = { lodGroup: 'a', lod: 0 };
    const lod2 = box();
    lod2.userData = { lodGroup: 'a', lod: 2 };
    lod2.position.set(100, 0, 0);
    root.add(lod0, lod2);
    const stats = computeObjectStats(root);
    expect(stats.triangles).toBe(12);
    expect(stats.meshes).toBe(1);
    expect(stats.drawCalls).toBe(1);
    expect(stats.lodLevels).toBe(3);
    // 멀리 놓인 LOD 사본이 크기를 부풀리지 않는다.
    expect(stats.size).toEqual([1, 1, 1]);
  });

  it('LOD 캐리어의 자식 메쉬도 사본으로 본다', () => {
    const carrier = new Group();
    carrier.userData = { tile: [0, 0], lod: 1 };
    carrier.add(box());
    const root = new Group();
    root.add(carrier, box());
    expect(computeObjectStats(root).triangles).toBe(12);
  });

  it('머티리얼 배열은 그룹 수만큼 드로우콜이다', () => {
    const multi = new Mesh(new BoxGeometry(1, 1, 1), [
      new MeshBasicMaterial(),
      new MeshBasicMaterial(),
    ]);
    // BoxGeometry 는 면마다 그룹이 있어 6.
    expect(computeObjectStats(multi).drawCalls).toBe(6);
  });

  it('텍스처는 고유 개수와 RGBA·밉맵 기준 메모리를 낸다', () => {
    const map = texture(1024, 512);
    const a = new MeshStandardMaterial({ map, normalMap: texture(256, 256) });
    const b = new MeshStandardMaterial({ map });
    const root = new Group();
    root.add(box(a), box(b));
    const stats = computeObjectStats(root);
    expect(stats.textures).toBe(2);
    expect(stats.textureMemoryBytes).toBe(
      Math.round(1024 * 512 * 4 * 1.33) + Math.round(256 * 256 * 4 * 1.33),
    );
  });

  it('크기를 모르는 텍스처는 0 바이트로 센다', () => {
    const blank = new Texture();
    const root = box(new MeshStandardMaterial({ map: blank }));
    const stats = computeObjectStats(root);
    expect(stats.textures).toBe(1);
    expect(stats.textureMemoryBytes).toBe(0);
  });

  it('회전한 메쉬의 크기는 정점 기준이다(AABB 를 돌려 부풀리지 않는다)', () => {
    const long = new Mesh(new BoxGeometry(10, 1, 1), new MeshBasicMaterial());
    long.rotation.y = Math.PI / 2;
    const size = computeObjectStats(long).size!;
    expect(size[0]).toBeCloseTo(1);
    expect(size[2]).toBeCloseTo(10);
  });

  it('스케일·위치가 실린 계층의 월드 크기를 낸다', () => {
    const child = box();
    child.position.set(5, 0, 0);
    const root = new Group();
    root.scale.set(2, 2, 2);
    root.add(child, box());
    const size = computeObjectStats(root).size!;
    // x: [-1, 11] → 12, y·z: 2.
    expect(size[0]).toBeCloseTo(12);
    expect(size[1]).toBeCloseTo(2);
  });
});

describe('computeRenderBounds', () => {
  it('메쉬가 없으면 빈 상자', () => {
    expect(computeRenderBounds(new Group()).isEmpty()).toBe(true);
  });

  it('넘겨받은 상자를 채워 돌려준다', () => {
    const mesh = box();
    mesh.position.set(0, 3, 0);
    const bounds = computeRenderBounds(mesh);
    expect(bounds.min.y).toBeCloseTo(2.5);
    expect(bounds.max.y).toBeCloseTo(3.5);
  });
});

describe('스킨 메쉬의 경계', () => {
  it('메쉬 노드의 행렬이 아니라 뼈대가 놓은 자리로 잰다', () => {
    const { armature } = quantizedPerson();
    const size = computeObjectStats(armature).size!;
    // position 속성에 노드 행렬만 곱하면 ±1 정육면체 × 축소 배율(0.02)이다.
    expect(size[0]).toBeCloseTo(0.5, 5);
    expect(size[1]).toBeCloseTo(1.8, 5);
    expect(size[2]).toBeCloseTo(0.3, 5);
  });

  it('computeRenderBounds 도 같은 상자를 낸다', () => {
    const { armature } = quantizedPerson();
    expectBounds(armature, [-0.25, 0, -0.15], [0.25, 1.8, 0.15]);
  });

  it('한 번도 그리지 않아 바인드 역행렬이 낡은 메쉬를 맞춰 놓고 잰다', () => {
    const { armature, mesh } = quantizedPerson();
    expect(mesh.bindMatrixInverse.equals(new Matrix4())).toBe(true);
    computeRenderBounds(armature);
    expect(
      mesh.bindMatrixInverse.equals(mesh.matrixWorld.clone().invert()),
    ).toBe(true);
  });

  it('다시 재도 같은 상자다', () => {
    const { armature } = quantizedPerson();
    const first = computeRenderBounds(armature).clone();
    const second = computeRenderBounds(armature);
    expect(second.equals(first)).toBe(true);
    expect(computeObjectStats(armature).size).toEqual(
      computeObjectStats(armature).size,
    );
  });

  it('스킨 메쉬 노드 자신의 위치·회전·배율은 결과를 바꾸지 않는다', () => {
    const { armature, mesh } = quantizedPerson();
    mesh.position.set(40, -7, 3);
    mesh.rotation.set(0.4, 1.1, -0.6);
    mesh.scale.setScalar(5);
    expectBounds(armature, [-0.25, 0, -0.15], [0.25, 1.8, 0.15]);
  });

  it('뼈가 옮겨 간 자세를 따라간다', () => {
    const { armature, bone } = quantizedPerson();
    // 뼈의 로컬은 뼈대 루트(1/100 배율) 기준이다 — 300 은 월드 3.
    bone.position.set(300, 0, 0);
    expectBounds(armature, [2.75, 0, -0.15], [3.25, 1.8, 0.15]);
  });

  it('뼈가 돌면 상자도 돈다', () => {
    const { armature, bone } = quantizedPerson();
    bone.rotation.z = Math.PI / 2;
    // 선 몸(y 0–1.8)이 -x 쪽으로 눕는다.
    expectBounds(armature, [-1.8, -0.25, -0.15], [0, 0.25, 0.15]);
  });

  it('가중치가 나뉜 정점은 두 뼈가 놓은 자리의 가중 평균이다', () => {
    const root = new Group();
    const still = new Bone();
    const moved = new Bone();
    root.add(still, moved);
    root.add(
      skinned(
        new BoxGeometry(1, 1, 1),
        [still, moved],
        [new Matrix4(), new Matrix4()],
        [0.75, 0.25],
      ),
    );
    moved.position.set(4, 0, 0);
    // 0.75·x + 0.25·(x + 4) = x + 1
    expectBounds(root, [0.5, -0.5, -0.5], [1.5, 0.5, 0.5]);
  });

  it('가중치 0 인 뼈는 움직여도 영향이 없다', () => {
    const root = new Group();
    const still = new Bone();
    const moved = new Bone();
    root.add(still, moved);
    root.add(
      skinned(
        new BoxGeometry(1, 1, 1),
        [still, moved],
        [new Matrix4(), new Matrix4()],
        [1, 0],
      ),
    );
    moved.position.set(4, 0, 0);
    expectBounds(root, [-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]);
  });

  it('일반 메쉬와 섞이면 둘을 합친 상자다', () => {
    const { armature } = quantizedPerson();
    const bike = new Mesh(
      new BoxGeometry(1.6, 1, 0.6),
      new MeshBasicMaterial(),
    );
    bike.position.set(0, 0.5, 0);
    const root = new Group();
    root.add(bike, armature);
    const stats = computeObjectStats(root);
    // x·z 는 자전거, y 는 사람이 정한다.
    expect(stats.size![0]).toBeCloseTo(1.6, 5);
    expect(stats.size![1]).toBeCloseTo(1.8, 5);
    expect(stats.size![2]).toBeCloseTo(0.6, 5);
    expect(stats.meshes).toBe(2);
  });

  it('LOD 사본 안의 스킨 메쉬는 상자에서 뺀다', () => {
    const { armature } = quantizedPerson();
    armature.userData = { lod: 1 };
    const root = new Group();
    root.add(armature, box());
    expect(computeObjectStats(root).size).toEqual([1, 1, 1]);
  });
});

describe('모프 타깃의 경계', () => {
  /** x 로 3배 늘어나는 모프 타깃 하나가 달린 1×1×1 상자. */
  function morphing() {
    const geometry = new BoxGeometry(1, 1, 1);
    const base = geometry.getAttribute('position');
    const stretched = base.clone();
    for (let i = 0; i < stretched.count; i += 1) {
      stretched.setX(i, base.getX(i) * 3);
    }
    geometry.morphAttributes.position = [stretched];
    return new Mesh(geometry, new MeshBasicMaterial());
  }

  it('영향값이 0 이면 원형 그대로 잰다', () => {
    expect(computeObjectStats(morphing()).size![0]).toBeCloseTo(1, 5);
  });

  it('영향값만큼 변형된 정점으로 잰다', () => {
    const mesh = morphing();
    mesh.morphTargetInfluences = [1];
    expect(computeObjectStats(mesh).size![0]).toBeCloseTo(3, 5);
    mesh.morphTargetInfluences = [0.5];
    expect(computeObjectStats(mesh).size![0]).toBeCloseTo(2, 5);
  });
});

describe('getLodLevel / isInsideLodCopy', () => {
  it('숫자가 아닌 lod·음수·NaN 은 0', () => {
    const node = new Group();
    for (const lod of ['2', -1, Number.NaN, null, undefined]) {
      node.userData = { lod };
      expect(getLodLevel(node)).toBe(0);
    }
    node.userData = { lod: 2.9 };
    expect(getLodLevel(node)).toBe(2);
  });

  it('루트 바깥의 조상은 보지 않는다', () => {
    const outer = new Group();
    outer.userData = { lod: 3 };
    const root = new Group();
    const mesh = box();
    outer.add(root);
    root.add(mesh);
    expect(isInsideLodCopy(mesh, root)).toBe(false);
  });
});
