import { describe, expect, it } from 'vitest';
import { hasRateLimits, rateLimitStep } from '../rate-limit';

describe('hasRateLimits', () => {
  it('양수 한계가 하나라도 있어야 true', () => {
    expect(hasRateLimits(undefined)).toBe(false);
    expect(hasRateLimits({})).toBe(false);
    expect(hasRateLimits({ maxSpeed: 0 })).toBe(false);
    expect(hasRateLimits({ maxSpeed: 1 })).toBe(true);
    expect(hasRateLimits({ maxAccel: 0.5 })).toBe(true);
  });
});

describe('rateLimitStep', () => {
  it('한계 없음·dt 비정상·값 비정상은 목표로 바로 가고 속도 0', () => {
    expect(rateLimitStep(0, 5, 10, 0.1, undefined)).toEqual({
      value: 10,
      velocity: 0,
    });
    expect(rateLimitStep(0, 5, 10, 0, { maxSpeed: 1 })).toEqual({
      value: 10,
      velocity: 0,
    });
    expect(rateLimitStep(NaN, 0, 10, 0.1, { maxSpeed: 1 })).toEqual({
      value: 10,
      velocity: 0,
    });
    expect(rateLimitStep(0, 0, NaN, 0.1, { maxSpeed: 1 })).toEqual({
      value: NaN,
      velocity: 0,
    });
  });

  it('속도 한계만: 한 틱에 maxSpeed·dt 까지만 움직이고 방향은 목표 쪽', () => {
    expect(rateLimitStep(0, 0, 10, 0.1, { maxSpeed: 2 })).toEqual({
      value: 0.2,
      velocity: 2,
    });
    expect(rateLimitStep(0, 0, -10, 0.1, { maxSpeed: 2 })).toEqual({
      value: -0.2,
      velocity: -2,
    });
    // 목표가 가까우면(한 틱 안) 정확히 목표에서 멈춘다.
    expect(rateLimitStep(0, 0, 0.1, 0.1, { maxSpeed: 2 })).toEqual({
      value: 0.1,
      velocity: 1,
    });
  });

  it('가속 한계: 속도 변화가 maxAccel·dt 이하이고 정지 거리 상한으로 목표에 멈춘다', () => {
    const limits = { maxSpeed: 10, maxAccel: 1 };
    let s = { value: 0, velocity: 0 };
    let maxVel = 0;
    for (let i = 0; i < 400; i += 1) {
      const next = rateLimitStep(s.value, s.velocity, 5, 0.05, limits);
      // 도착 스텝(목표에 스냅, 속도 0)만 속도 불연속을 허용한다.
      if (next.value !== 5) {
        expect(Math.abs(next.velocity - s.velocity)).toBeLessThanOrEqual(
          1 * 0.05 + 1e-9,
        );
      }
      expect(next.value).toBeLessThanOrEqual(5 + 1e-9);
      maxVel = Math.max(maxVel, next.velocity);
      s = next;
    }
    expect(s.value).toBeCloseTo(5, 6);
    expect(s.velocity).toBe(0);
    // 정지 거리 규칙: 최고 속도는 √(2·a·d) = √10 ≈ 3.16 을 넘지 않는다.
    expect(maxVel).toBeLessThanOrEqual(Math.sqrt(10) + 1e-6);
  });

  it('오버슈트 클램프 — 관성으로 목표를 지나치면 목표에서 멈춘다', () => {
    // 속도 10 으로 달리다 목표가 바로 앞(0.1)이면 감속 한계(1·dt) 로는 못
    // 멈추지만 값은 목표를 넘지 않는다.
    const next = rateLimitStep(0, 10, 0.1, 0.1, { maxAccel: 1 });
    expect(next.value).toBe(0.1);
    expect(next.velocity).toBe(0);
  });

  it('목표와 같으면 속도 0', () => {
    expect(rateLimitStep(3, 4, 3, 0.1, { maxSpeed: 1 })).toEqual({
      value: 3,
      velocity: 0,
    });
  });
});
