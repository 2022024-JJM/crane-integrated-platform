import { describe, expect, it } from 'vitest';
import { smoothDampStep } from '../smooth-damp';

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
});
