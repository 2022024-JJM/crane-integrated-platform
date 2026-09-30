import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, PerspectiveCamera } from 'three';
import { modelObjectRegistry } from '@crane/domain/3d';
import { TerrainLodController } from '../terrain-lod-controller';

/**
 * 타일 하나에 LOD0(오차 0)·LOD1(오차 2m) 두 노드. LOD1 은 기본 숨김(clone
 * 시점 규칙)이다. 카메라가 멀어지면 LOD1, 가까우면 LOD0 이 보여야 한다.
 */
function makeTile(root: Group, tile: number[], lodError = 2) {
  const lod0 = new Mesh(new BoxGeometry(10, 1, 10));
  lod0.userData = { tile, lod: 0 };
  const lod1 = new Mesh(new BoxGeometry(10, 1, 10));
  lod1.userData = { tile, lod: 1, lodError };
  lod1.visible = false;
  root.add(lod0, lod1);
  return { lod0, lod1 };
}

function camera(y: number) {
  const cam = new PerspectiveCamera(60, 1, 0.1, 1000);
  cam.position.set(0, y, 0);
  cam.updateMatrixWorld();
  return cam;
}

describe('TerrainLodController', () => {
  let root: Group;
  beforeEach(() => {
    modelObjectRegistry.clear();
    root = new Group();
    modelObjectRegistry.register('terrain', root);
  });
  afterEach(() => {
    modelObjectRegistry.clear();
  });

  it('LOD 노드가 없는 씬은 아무것도 바꾸지 않는다', () => {
    const controller = new TerrainLodController();
    expect(() => controller.apply('main', camera(100), 1000)).not.toThrow();
  });

  it('가까우면 LOD0, 멀면 LOD1 을 보인다 (같은 카메라 키)', () => {
    const { lod0, lod1 } = makeTile(root, [0, 0]);
    const controller = new TerrainLodController();
    controller.apply('main', camera(5), 1000);
    expect(lod0.visible).toBe(true);
    expect(lod1.visible).toBe(false);
    controller.apply('main', camera(5000), 1000);
    expect(lod0.visible).toBe(false);
    expect(lod1.visible).toBe(true);
  });

  it('카메라 키마다 상태가 따로다 — 번갈아 적용하면 각자의 레벨을 다시 쓴다', () => {
    const { lod0, lod1 } = makeTile(root, [0, 0]);
    const controller = new TerrainLodController();
    const near = camera(5);
    const far = camera(5000);
    controller.apply('near', near, 1000);
    controller.apply('far', far, 1000);
    expect(lod1.visible).toBe(true);
    // 가까운 카메라 차례 — 카메라가 멈춰 있어도(이동 게이트) 가시성은 다시 쓴다.
    controller.apply('near', near, 1000);
    expect(lod0.visible).toBe(true);
    expect(lod1.visible).toBe(false);
    controller.apply('far', far, 1000);
    expect(lod1.visible).toBe(true);
  });

  it('뷰포트 높이가 작아지면(타일) 같은 거리에서도 거친 레벨을 고른다', () => {
    const { lod1 } = makeTile(root, [0, 0], 0.5);
    const controller = new TerrainLodController();
    // 큰 화면에서는 LOD0.
    controller.apply('main', camera(300), 2000);
    expect(lod1.visible).toBe(false);
    // 세로 픽셀이 1/20 이면 오차가 임계 아래로 내려가 LOD1.
    controller.apply('small', camera(300), 100);
    expect(lod1.visible).toBe(true);
  });

  it('레지스트리가 바뀌면 타일을 다시 찾고 새 노드도 적용한다', () => {
    const controller = new TerrainLodController();
    controller.apply('main', camera(5000), 1000);
    const { lod1 } = makeTile(root, [1, 0]);
    const other = new Group();
    modelObjectRegistry.register('other', other);
    controller.apply('main', camera(5000), 1000);
    expect(lod1.visible).toBe(true);
  });
});
