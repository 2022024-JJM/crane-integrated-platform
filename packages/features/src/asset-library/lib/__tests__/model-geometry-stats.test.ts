import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Texture,
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
