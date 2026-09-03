import { describe, expect, it } from 'vitest';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  snapChangedAxes,
  snapStepFor,
  snapToStep,
  stepOnGrid,
} from '../snap-transform';

const DEG = Math.PI / 180;

describe('snapToStep', () => {
  it('보고 사례: 음수·큰 절대값 위치가 1m 격자로 간다', () => {
    expect(snapToStep(-2209.316, 1)).toBe(-2209);
    expect(snapToStep(-2209.716, 1)).toBe(-2210);
    expect(snapToStep(1916.872, 1)).toBe(1917);
  });

  it('정확히 중간값은 JS Math.round 방향(+∞ 쪽)을 그대로 따른다 (특성화)', () => {
    expect(snapToStep(-2209.5, 1)).toBe(-2209);
    expect(snapToStep(2.5, 1)).toBe(3);
  });

  it('0.1·0.25 격자에서 부동소수 잡음이 남지 않는다', () => {
    expect(snapToStep(0.3000000001, 0.1)).toBe(0.3);
    expect(snapToStep(1.234, 0.1)).toBe(1.2);
    expect(snapToStep(0.37, 0.25)).toBe(0.25);
    expect(snapToStep(0.38, 0.25)).toBe(0.5);
    expect(snapToStep(-0.13, 0.25)).toBe(-0.25);
  });

  it('큰 절대값에서도 격자 정확값이 나온다', () => {
    expect(snapToStep(1_000_000.3, 1)).toBe(1_000_000);
    expect(snapToStep(1_000_000.26, 0.25)).toBe(1_000_000.25);
  });

  it('이미 격자 위면 같은 값을 돌려준다', () => {
    expect(snapToStep(-2209, 1)).toBe(-2209);
    expect(snapToStep(0, 1)).toBe(0);
    expect(snapToStep(0.5, 0.25)).toBe(0.5);
  });

  it('0 근처 음수는 -0 이 아니라 +0 이 된다', () => {
    expect(Object.is(snapToStep(-0.3, 1), 0)).toBe(true);
  });

  it('비유한 값이나 잘못된 step 은 원값을 돌려준다', () => {
    expect(snapToStep(NaN, 1)).toBeNaN();
    expect(snapToStep(Infinity, 1)).toBe(Infinity);
    expect(snapToStep(1.234, 0)).toBe(1.234);
    expect(snapToStep(1.234, -1)).toBe(1.234);
    expect(snapToStep(1.234, NaN)).toBe(1.234);
  });

  it('회전 15° 격자', () => {
    expect(snapToStep(37.3, 15)).toBe(30);
    expect(snapToStep(37.6, 15)).toBe(45);
    expect(snapToStep(352.6, 15)).toBe(360);
    expect(snapToStep(-7.4, 15)).toBe(0);
  });
});

describe('stepOnGrid', () => {
  it('격자 밖이면 방향 쪽 가장 가까운 격자로 먼저 간다', () => {
    expect(stepOnGrid(-2209.316, 1, 1)).toBe(-2209);
    expect(stepOnGrid(-2209.316, 1, -1)).toBe(-2210);
    expect(stepOnGrid(-2209.716, 1, 1)).toBe(-2209);
    expect(stepOnGrid(-2209.716, 1, -1)).toBe(-2210);
  });

  it('격자 위면 ±step 만큼 움직인다', () => {
    expect(stepOnGrid(-2209, 1, 1)).toBe(-2208);
    expect(stepOnGrid(-2209, 1, -1)).toBe(-2210);
    expect(stepOnGrid(0, 0.25, 1)).toBe(0.25);
  });

  it('0.1 격자에서 0.25 는 위로 0.3, 아래로 0.2', () => {
    expect(stepOnGrid(0.25, 0.1, 1)).toBe(0.3);
    expect(stepOnGrid(0.25, 0.1, -1)).toBe(0.2);
  });

  it('연속으로 누르면 격자를 따라 정확히 누적된다', () => {
    let v = 13.39;
    for (let i = 0; i < 5; i += 1) v = stepOnGrid(v, 0.1, 1);
    expect(v).toBe(13.8);
  });

  it('회전 15° 격자: 352.6 에서 ▲ 는 360 (정규화는 커밋 경로 몫)', () => {
    expect(stepOnGrid(352.6, 15, 1)).toBe(360);
    expect(stepOnGrid(352.6, 15, -1)).toBe(345);
  });

  it('비유한 값이나 잘못된 step 은 원값을 돌려준다', () => {
    expect(stepOnGrid(NaN, 1, 1)).toBeNaN();
    expect(stepOnGrid(1.5, 0, 1)).toBe(1.5);
  });
});

describe('snapStepFor', () => {
  const step = { translation: 1, rotation: 15 * DEG, scale: 0.1 } as const;

  it('position 은 translation 단위 그대로', () => {
    expect(snapStepFor('position', step)).toBe(1);
  });

  it('rotation 은 라디안을 도로 환산해 정확한 15 를 낸다', () => {
    expect(snapStepFor('rotation', step)).toBe(15);
    expect(snapStepFor('rotation', { ...step, rotation: 5 * DEG })).toBe(5);
    expect(snapStepFor('rotation', { ...step, rotation: 45 * DEG })).toBe(45);
  });

  it('scale 은 scale 단위 그대로', () => {
    expect(snapStepFor('scale', step)).toBe(0.1);
  });
});

describe('snapChangedAxes', () => {
  it('보고 사례: yaw 5.6° 모델을 local X 로 끌면 부모 프레임 X·Z 가 함께 변하고 둘 다 격자로 간다', () => {
    // TransformControls 가 local X 축 1m 이동을 부모 프레임으로 풀면
    // (0.9952, 0, -0.0976) 이 더해진다. Y 는 그대로다.
    const start: Vector3Tuple = [-2209.316, 0.35, 1916.872];
    const current: Vector3Tuple = [-2210.311, 0.35, 1916.774];
    expect(snapChangedAxes(start, current, 1)).toEqual([-2210, 0.35, 1917]);
  });

  it('안 움직인 축은 격자 밖이어도 건드리지 않는다', () => {
    const start: Vector3Tuple = [-2209.316, 0.35, 1916.872];
    // Y 만 드래그
    const current: Vector3Tuple = [-2209.316, 2.8, 1916.872];
    expect(snapChangedAxes(start, current, 1)).toEqual([
      -2209.316, 3, 1916.872,
    ]);
  });

  it('회전된 프레임에서 오는 1e-17 급 잡음은 변화로 보지 않는다', () => {
    const start: Vector3Tuple = [0, 0.35, 0];
    const current: Vector3Tuple = [3.2, 0.35 + 1e-15, 0];
    expect(snapChangedAxes(start, current, 1)).toEqual([3, 0.35 + 1e-15, 0]);
  });

  it('어느 축도 안 변했으면 current 참조를 그대로 돌려준다', () => {
    const start: Vector3Tuple = [-2209.316, 0.35, 1916.872];
    const current: Vector3Tuple = [-2209.316, 0.35, 1916.872];
    expect(snapChangedAxes(start, current, 1)).toBe(current);
  });

  it('변한 축이 이미 격자 위면 current 참조를 그대로 돌려준다', () => {
    const start: Vector3Tuple = [0, 0, 0];
    const current: Vector3Tuple = [3, 0, 0];
    expect(snapChangedAxes(start, current, 1)).toBe(current);
  });

  it('회전 15° 격자: 37.3 → 30, 352.6 → 360 (정규화 안 함)', () => {
    expect(snapChangedAxes([0, 0, 0], [0, 37.3, 0], 15)).toEqual([0, 30, 0]);
    expect(snapChangedAxes([0, 340, 0], [0, 352.6, 0], 15)).toEqual([
      0, 360, 0,
    ]);
  });

  it('크기 0.1 격자: 1.234 → 1.2, 0.04 → 0 (0 허용은 커밋 경로 몫)', () => {
    expect(snapChangedAxes([1, 1, 1], [1.234, 1, 1], 0.1)).toEqual([1.2, 1, 1]);
    expect(snapChangedAxes([1, 1, 1], [0.04, 1, 1], 0.1)).toEqual([0, 1, 1]);
  });

  it('잘못된 step 은 current 를 그대로 돌려준다', () => {
    const current: Vector3Tuple = [1.5, 2.5, 3.5];
    expect(snapChangedAxes([0, 0, 0], current, 0)).toBe(current);
    expect(snapChangedAxes([0, 0, 0], current, NaN)).toBe(current);
  });

  it('입력 tuple 을 변이하지 않는다', () => {
    const start: Vector3Tuple = [0, 0, 0];
    const current: Vector3Tuple = [1.4, 0, 0];
    snapChangedAxes(start, current, 1);
    expect(current).toEqual([1.4, 0, 0]);
  });
});
