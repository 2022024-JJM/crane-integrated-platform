import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh } from 'three';
import { computeFrontalView, computeFrontalViewFromObjects } from '../compute-frontal-view';

function meshOfSize(x: number, y: number, z: number): Mesh {
  return new Mesh(new BoxGeometry(x, y, z));
}

describe('computeFrontalView', () => {
  it('빈 오브젝트는 null', () => {
    expect(computeFrontalView(new Group())).toBeNull();
  });

  it('긴 축이 z(스팬)이면 x축에서 바라본다', () => {
    // x=2(깊이) < z=20(스팬) → 시선축 x: 카메라가 +x에 위치, z는 center 유지
    const view = computeFrontalView(meshOfSize(2, 5, 20));
    expect(view).not.toBeNull();
    const [px, , pz] = view!.position;
    expect(px).toBeGreaterThan(1); // 모델(+1이 max.x) 바깥
    expect(pz).toBeCloseTo(0, 5);
    expect(view!.target).toEqual([0, 0, 0]);
  });

  it('긴 축이 x이면 z축에서 바라본다', () => {
    const view = computeFrontalView(meshOfSize(20, 5, 2));
    const [px, , pz] = view!.position;
    expect(pz).toBeGreaterThan(1);
    expect(px).toBeCloseTo(0, 5);
  });

  it('카메라는 모델 표면 밖에 위치한다', () => {
    const view = computeFrontalView(meshOfSize(4, 4, 4));
    const [px] = view!.position;
    // size 4 → max.x = 2, 카메라 x는 그보다 커야 함
    expect(Math.abs(px)).toBeGreaterThan(2);
  });

  it('카메라 y는 중심보다 살짝 위(높이의 10%)', () => {
    const view = computeFrontalView(meshOfSize(2, 10, 20));
    expect(view!.position[1]).toBeCloseTo(1, 5); // 10 * 0.1
  });
});

describe('computeFrontalViewFromObjects', () => {
  it('빈 배열은 null', () => {
    expect(computeFrontalViewFromObjects([])).toBeNull();
  });

  it('여러 파트의 합집합 박스를 기준으로 계산한다', () => {
    const a = meshOfSize(2, 2, 2);
    const b = meshOfSize(2, 2, 2);
    b.position.set(0, 0, 10); // z로 벌어진 두 파트 → 합집합 z 스팬이 김
    const view = computeFrontalViewFromObjects([a, b]);
    expect(view).not.toBeNull();
    // 합집합 중심은 z=5
    expect(view!.target[2]).toBeCloseTo(5, 5);
    // z 스팬(12) > x(2) → x축 시선
    expect(view!.position[2]).toBeCloseTo(5, 5);
    expect(view!.position[0]).toBeGreaterThan(1);
  });
});
