import { describe, expect, it } from 'vitest';
import { SMOOTH_SETTLE_EPS, smoothDampStep } from '../smooth-damp';

describe('smoothDampStep', () => {
  it('smoothTime 0 이면 즉시 목표로 점프하고 속도는 0', () => {
    const s = { value: 0, velocity: 5 };
    expect(smoothDampStep(s, 10, 0, 1 / 60)).toBe(10);
    expect(s.velocity).toBe(0);
  });

  it('dt 0 이면 즉시 목표', () => {
    const s = { value: 0, velocity: 0 };
    expect(smoothDampStep(s, 3, 0.3, 0)).toBe(3);
  });

  it('목표가 NaN/Infinity 면 0 으로 고정하고 상태를 오염시키지 않는다', () => {
    const s = { value: 1, velocity: 1 };
    expect(smoothDampStep(s, NaN, 0.3, 0.016)).toBe(0);
    expect(s.velocity).toBe(0);
    expect(smoothDampStep(s, Infinity, 0.3, 0.016)).toBe(0);
  });

  it('현재값이 NaN 이면 목표로 복구한다', () => {
    const s = { value: NaN, velocity: 0 };
    expect(smoothDampStep(s, 4, 0.3, 0.016)).toBe(4);
  });

  it('단조 수렴 — 오버슈트하지 않고 smoothTime 몇 배 안에 정착한다', () => {
    const s = { value: 0, velocity: 0 };
    let prev = 0;
    for (let i = 0; i < 60; i++) {
      const v = smoothDampStep(s, 10, 0.2, 1 / 60);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(10);
      prev = v;
    }
    expect(prev).toBeCloseTo(10, 1);
  });

  it('목표가 낮아질 때도 대칭으로 동작한다', () => {
    const s = { value: 10, velocity: 0 };
    let prev = 10;
    for (let i = 0; i < 60; i++) {
      const v = smoothDampStep(s, 0, 0.2, 1 / 60);
      expect(v).toBeLessThanOrEqual(prev);
      expect(v).toBeGreaterThanOrEqual(0);
      prev = v;
    }
    expect(prev).toBeCloseTo(0, 1);
  });

  it('이미 목표에 있으면 그대로 머문다', () => {
    const s = { value: 5, velocity: 0 };
    expect(smoothDampStep(s, 5, 0.3, 0.016)).toBe(5);
    expect(s.velocity).toBe(0);
  });

  describe('정착 스냅', () => {
    it('충분히 지나면 value 가 target 과 정확히 같아지고 속도는 0 이다 — 위·아래 모두', () => {
      for (const [from, target] of [
        [0, 10],
        [10, 0],
        [-42.567, 13.9],
      ] as const) {
        const s = { value: from, velocity: 0 };
        for (let i = 0; i < 600; i++) smoothDampStep(s, target, 0.35, 1 / 60);
        expect(s.value).toBe(target);
        expect(s.velocity).toBe(0);
      }
    });

    it('긴 smoothTime(상한 2초)도 30fps 로 수십 초 안에 정확히 정착한다', () => {
      const s = { value: 0, velocity: 0 };
      let settledAt = -1;
      for (let i = 0; i < 2000; i++) {
        smoothDampStep(s, 50, 2, 1 / 30);
        if (s.value === 50) {
          settledAt = i;
          break;
        }
      }
      expect(settledAt).toBeGreaterThan(0);
      expect(s.velocity).toBe(0);
    });

    it('스냅은 잔차·속도가 모두 임계 아래일 때만 — 임계 밖 잔차는 그대로 수렴 중', () => {
      // 잔차가 임계보다 크면(속도 0 이어도) 스냅하지 않는다.
      const s = { value: 10 - SMOOTH_SETTLE_EPS * 10, velocity: 0 };
      smoothDampStep(s, 10, 0.35, 1 / 60);
      expect(s.value).not.toBe(10);
      expect(s.value).toBeLessThan(10);
    });

    it('연속 램프 추종 중에는 스냅이 끼어들지 않는다 — 잔차가 속도 × smoothTime 만큼 남는다', () => {
      const s = { value: 0, velocity: 0 };
      let target = 0;
      // 60fps 로 초당 0.6 씩 오르는 목표. 정상 상태 지연 ≈ 0.6 × 0.5 = 0.3.
      for (let i = 0; i < 600; i++) {
        target += 0.01;
        smoothDampStep(s, target, 0.5, 1 / 60);
      }
      expect(s.value).not.toBe(target);
      expect(target - s.value).toBeGreaterThan(0.1);
      expect(target - s.value).toBeLessThan(0.5);
      expect(s.velocity).toBeGreaterThan(0);
    });
  });
});
