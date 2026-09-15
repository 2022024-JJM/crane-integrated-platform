import { afterEach, describe, expect, it } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { modelObjectRegistry } from '../model-object-registry';
import { raycastMapSurfaceY, sampleMapsSurfaceY } from '../map-surface-raycast';
import type { SavedMapInfo } from '../../model/types';

/** y 높이에 놓인 10×10 수평 바닥판 (위를 향함) */
function flatGround(y: number): Mesh {
  const mesh = new Mesh(new PlaneGeometry(10, 10), new MeshBasicMaterial());
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe('raycastMapSurfaceY', () => {
  it('표면 위 (x, z)에서 표면의 y를 돌려준다', () => {
    const ground = flatGround(3.5);
    expect(raycastMapSurfaceY(ground, 0, 0)).toBeCloseTo(3.5, 5);
    expect(raycastMapSurfaceY(ground, 4.9, -4.9)).toBeCloseTo(3.5, 5);
  });

  it('표면 밖 (x, z)는 null', () => {
    const ground = flatGround(0);
    expect(raycastMapSurfaceY(ground, 100, 0)).toBeNull();
  });

  it('자식까지 재귀로 검사한다', () => {
    const group = new Group();
    group.add(flatGround(-12.4)); // 드라이독처럼 음수 높이도 그대로
    group.updateMatrixWorld(true);
    expect(raycastMapSurfaceY(group, 1, 1)).toBeCloseTo(-12.4, 5);
  });

  it('겹친 표면은 가장 높은(가까운) 히트를 돌려준다', () => {
    const group = new Group();
    group.add(flatGround(2), flatGround(8));
    group.updateMatrixWorld(true);
    expect(raycastMapSurfaceY(group, 0, 0)).toBeCloseTo(8, 5);
  });

  it('빈 객체는 null', () => {
    expect(raycastMapSurfaceY(new Group(), 0, 0)).toBeNull();
  });
});

describe('sampleMapsSurfaceY', () => {
  const mapA: SavedMapInfo = { id: 'map-a', path: '/maps/a.glb' };
  const mapB: SavedMapInfo = { id: 'map-b', path: '/maps/b.glb' };

  afterEach(() => {
    modelObjectRegistry.clear();
  });

  it('maps 가 null/undefined/빈 배열이면 null', () => {
    expect(sampleMapsSurfaceY(null, 0, 0)).toBeNull();
    expect(sampleMapsSurfaceY(undefined, 0, 0)).toBeNull();
    expect(sampleMapsSurfaceY([], 0, 0)).toBeNull();
  });

  it('레지스트리에 없는(미로드) 지도는 건너뛰고, 아무것도 없으면 null', () => {
    expect(sampleMapsSurfaceY([mapA, mapB], 0, 0)).toBeNull();
  });

  it('등록된 지도의 표면 y 를 돌려준다 (음수 높이도 그대로)', () => {
    modelObjectRegistry.register(mapA.id, flatGround(-8.9));
    expect(sampleMapsSurfaceY([mapA], 1, 1)).toBeCloseTo(-8.9, 5);
  });

  it('여러 지도가 겹치면 가장 높은 y — 미등록 지도가 섞여도 무시한다', () => {
    modelObjectRegistry.register(mapA.id, flatGround(3.587));
    modelObjectRegistry.register(mapB.id, flatGround(0.593));
    const unknown: SavedMapInfo = { id: 'map-c', path: '/maps/c.glb' };
    expect(sampleMapsSurfaceY([mapB, unknown, mapA], 0, 0)).toBeCloseTo(
      3.587,
      5,
    );
  });

  it('모든 지도가 (x, z) 를 덮지 않으면 null (폴백은 호출자 몫)', () => {
    modelObjectRegistry.register(mapA.id, flatGround(2));
    modelObjectRegistry.register(mapB.id, flatGround(5));
    expect(sampleMapsSurfaceY([mapA, mapB], 100, 100)).toBeNull();
  });
});
