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

  it('유한한 스텝 안에 target 에 정확히 닿는다(ε 스냅) — 지수 수렴이 영원히 남지 않는다', () => {
    const s = { value: 0, velocity: 0 };
    let steps = 0;
    while (s.value !== 10 && steps < 10_000) {
      smoothDampStep(s, 10, 0.35, 1 / 60);
      steps++;
    }
    expect(s.value).toBe(10);
    expect(s.velocity).toBe(0);
    // smoothTime 0.35s 면 2~3초(≈120~180 프레임) 안에 정착한다.
    expect(steps).toBeLessThan(240);
  });

  it('ε 스냅은 값·속도가 함께 임계 아래일 때만 — 임계 바깥은 한 스텝에 고정되지 않는다', () => {
    const near = { value: 10 - SMOOTH_SETTLE_EPS / 2, velocity: 0 };
    smoothDampStep(near, 10, 0.35, 1 / 60);
    expect(near.value).toBe(10);
    expect(near.velocity).toBe(0);

    const far = { value: 10 - SMOOTH_SETTLE_EPS * 10, velocity: 0 };
    smoothDampStep(far, 10, 0.35, 1 / 60);
    expect(far.value).not.toBe(10);
  });

  it('이미 목표에 있으면 그대로 머문다', () => {
    const s = { value: 5, velocity: 0 };
    expect(smoothDampStep(s, 5, 0.3, 0.016)).toBe(5);
    expect(s.velocity).toBe(0);
  });
});
