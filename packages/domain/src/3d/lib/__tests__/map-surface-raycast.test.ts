import { describe, expect, it } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { raycastMapSurfaceY } from '../map-surface-raycast';

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
