import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { computeFrontalViewFromBox } from './compute-frontal-view';

/**
 * 자산 정보 탭 정면 뷰(CraneFrontView)가 의존하는 프레이밍 계산 검증.
 * 실제 두 크레인의 대략적 치수를 스케일 적용 후 값으로 넣어, 카메라가
 * 모델 밖에서 전체를 담는 위치에 놓이는지 확인한다.
 */
function boxOf(x: number, y: number, z: number): Box3 {
  return new Box3(new Vector3(-x / 2, 0, -z / 2), new Vector3(x / 2, y, z / 2));
}

describe('정면 뷰 프레이밍', () => {
  it('660T 골리앗(스팬이 긴 축)은 짧은 축에서 바라본다', () => {
    // 스팬 105m·높이 76m 모델에 scale 0.1 → 대략 10.5 x 7.6 x 2.0
    const view = computeFrontalViewFromBox(boxOf(10.5, 7.6, 2.0));
    expect(view).not.toBeNull();
    // 짧은 수평축이 z(2.0)이므로 카메라는 z축 방향에 선다 → 스팬이 가로로 펼쳐진다
    const [x, , z] = view!.position;
    expect(Math.abs(z)).toBeGreaterThan(Math.abs(x));
  });

  it('50T 러핑(높이가 큰 축)도 전체가 담기는 거리를 확보한다', () => {
    // 높이 53m 모델에 scale 0.15 → 대략 3.0 x 8.0 x 3.0
    const view = computeFrontalViewFromBox(boxOf(3.0, 8.0, 3.0));
    expect(view).not.toBeNull();
    const [x, , z] = view!.position;
    // 수평 두 축이 같으면 시선축은 x가 되므로, 실제 카메라 거리로 판정한다.
    // 높이의 절반(4.0)보다 멀어야 세로 전체가 화면에 들어온다.
    expect(Math.hypot(x, z)).toBeGreaterThan(4.0);
  });

  it('타깃은 모델 중심을 향한다', () => {
    const view = computeFrontalViewFromBox(boxOf(10, 8, 2));
    expect(view!.target[0]).toBeCloseTo(0);
    expect(view!.target[1]).toBeCloseTo(4);
  });

  it('카메라는 모델 표면 바깥에 위치한다', () => {
    const depth = 2.0;
    const view = computeFrontalViewFromBox(boxOf(10.5, 7.6, depth));
    // 시선축 방향 거리가 모델 깊이의 절반을 넘어야 내부에서 보지 않는다
    expect(Math.abs(view!.position[2])).toBeGreaterThan(depth / 2);
  });

  it('빈 박스는 null — 모델 로드 전 프레이밍을 시도하지 않는다', () => {
    expect(computeFrontalViewFromBox(new Box3())).toBeNull();
  });
});
