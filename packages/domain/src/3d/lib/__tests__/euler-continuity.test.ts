import { describe, expect, it } from 'vitest';
import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import { resolveEulerContinuity } from '../euler-continuity';

describe('resolveEulerContinuity', () => {
  it('y가 90°를 넘으며 플립된 표현을 연속 표현으로 되돌린다', () => {
    // 실제 자세 (0,95,0)을 three가 (-180,85,-180)으로 추출한 상황
    expect(resolveEulerContinuity([0, 85, 0], [-180, 85, -180])).toEqual([
      0, 95, 0,
    ]);
  });

  it('y가 180°를 넘어 계속 진행해도 연속 값을 유지한다', () => {
    // 실제 자세 (0,185,0) → three 추출 (-180,-5,-180)
    expect(resolveEulerContinuity([0, 175, 0], [-180, -5, -180])).toEqual([
      0, 185, 0,
    ]);
  });

  it('플립이 없으면 현재 값을 그대로 돌려준다 (항등)', () => {
    expect(resolveEulerContinuity([0, 45, 0], [0, 50, 0])).toEqual([0, 50, 0]);
    expect(resolveEulerContinuity([30, 0, 0], [35, 0, 0])).toEqual([35, 0, 0]);
    expect(resolveEulerContinuity([0, 0, 120], [0, 0, 125])).toEqual([
      0, 0, 125,
    ]);
  });

  it('값이 변하지 않았으면 그대로다 (rotate 외 모드의 매 프레임 호출)', () => {
    expect(resolveEulerContinuity([10, 20, 30], [10, 20, 30])).toEqual([
      10, 20, 30,
    ]);
  });

  it('360 경계에서 prev 최근접 등가각으로 이어붙인다', () => {
    expect(resolveEulerContinuity([0, 350, 0], [0, -5, 0])).toEqual([
      0, 355, 0,
    ]);
    expect(resolveEulerContinuity([0, 355, 0], [0, 2, 0])).toEqual([0, 362, 0]);
  });

  it('y가 90° 아래로 복귀하면 직접 표현을 채택한다', () => {
    expect(resolveEulerContinuity([0, 95, 0], [0, 85, 0])).toEqual([0, 85, 0]);
  });

  it('비유한값이 섞이면 현재 값을 그대로 반환한다', () => {
    expect(resolveEulerContinuity([0, Number.NaN, 0], [0, 50, 0])).toEqual([
      0, 50, 0,
    ]);
    const withNaN: Vector3Tuple = [0, Number.NaN, 0];
    expect(resolveEulerContinuity([0, 45, 0], withNaN)).toBe(withNaN);
  });

  it('Y축 한 바퀴 스윕: three의 플립된 추출을 통과시켜도 X/Z가 튀지 않는다', () => {
    // 사용자 재현 시나리오 — y를 5° 스텝으로 355°까지 돌리며, 매 스텝
    // three의 실제 Euler 추출값을 연속성 보정에 통과시킨다.
    const axis = new Vector3(0, 1, 0);
    const quat = new Quaternion();
    const euler = new Euler(0, 0, 0, 'XYZ');
    let prev: Vector3Tuple = [0, 0, 0];

    for (let deg = 5; deg < 360; deg += 5) {
      quat.setFromAxisAngle(axis, MathUtils.degToRad(deg));
      euler.setFromQuaternion(quat, 'XYZ');
      const extracted: Vector3Tuple = [
        MathUtils.radToDeg(euler.x),
        MathUtils.radToDeg(euler.y),
        MathUtils.radToDeg(euler.z),
      ];
      const resolved = resolveEulerContinuity(prev, extracted);

      // X/Z는 한 바퀴 내내 0 근방 — "0에서 180으로 튐" 회귀를 직접 잡는다
      expect(Math.abs(resolved[0])).toBeLessThan(1e-6);
      expect(Math.abs(resolved[2])).toBeLessThan(1e-6);
      // Y는 실제 각도를 연속으로 따라간다
      expect(resolved[1]).toBeCloseTo(deg, 6);

      prev = resolved;
    }
  });
});
