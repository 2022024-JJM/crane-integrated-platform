import type { VirtualTagLimits } from '../model/types';

/**
 * 속도·가속 한계 — 목표값(파형·시나리오)을 향해 한 틱 전진한 값과 속도.
 * 순수 함수. 러너가 틱마다 부르고 `velocity` 를 상태에 들고 다닌다.
 *
 * 규칙(단위는 태그 단위/초):
 * - 속도 한계 `maxSpeed` 만 있으면 |Δ/dt| 를 그 이하로 자른다.
 * - 가속 한계 `maxAccel` 이 있으면 속도 변화량을 `maxAccel·dt` 이하로 자르고,
 *   목표에 멈춰 서도록 **정지 거리** 기준 상한도 건다 — 이산 스텝에서 a·dt 씩
 *   감속해 정확히 멈출 수 있는 최대 속도 v = −a·dt/2 + √((a·dt/2)² + 2·a·|d|)
 *   (연속식 √(2·a·|d|) 는 한 스텝만큼 늦어 목표를 지나친다). 이게 없으면
 *   목표를 지나쳤다 되돌아오는 진동이 생긴다.
 * - 그래도 목표를 넘어서게 되면 목표에서 멈춘다(오버슈트 클램프, 속도 0 —
 *   도착 스텝의 유일한 속도 불연속).
 * - 한계가 없거나 dt·값이 비정상이면 목표로 바로 간다(속도 0).
 */
export interface RateLimitState {
  value: number;
  velocity: number;
}

export function hasRateLimits(limits: VirtualTagLimits | undefined): boolean {
  return (
    !!limits &&
    ((limits.maxSpeed !== undefined && limits.maxSpeed > 0) ||
      (limits.maxAccel !== undefined && limits.maxAccel > 0))
  );
}

export function rateLimitStep(
  current: number,
  velocity: number,
  target: number,
  dtSec: number,
  limits: VirtualTagLimits | undefined,
): RateLimitState {
  if (
    !hasRateLimits(limits) ||
    !Number.isFinite(dtSec) ||
    dtSec <= 0 ||
    !Number.isFinite(current) ||
    !Number.isFinite(target)
  ) {
    return { value: target, velocity: 0 };
  }
  const u0 = Number.isFinite(velocity) ? velocity : 0;
  const d = target - current;
  if (d === 0) return { value: target, velocity: 0 };
  const sign = Math.sign(d);
  const dist = Math.abs(d);
  const maxSpeed = limits!.maxSpeed;
  const maxAccel = limits!.maxAccel;

  // 원하는 속도: 한 틱에 도달할 속도를 상한들로 자른다.
  let desired = dist / dtSec;
  if (maxSpeed !== undefined && maxSpeed > 0) {
    desired = Math.min(desired, maxSpeed);
  }
  if (maxAccel !== undefined && maxAccel > 0) {
    const half = (maxAccel * dtSec) / 2;
    desired = Math.min(
      desired,
      -half + Math.sqrt(half * half + 2 * maxAccel * dist),
    );
  }
  let u = sign * desired;
  if (maxAccel !== undefined && maxAccel > 0) {
    const du = maxAccel * dtSec;
    u = Math.min(u0 + du, Math.max(u0 - du, u));
  }
  let value = current + u * dtSec;
  // 오버슈트 — 목표를 지나면 목표에서 정지.
  if ((target - value) * sign < 0) {
    value = target;
    u = 0;
  }
  return { value, velocity: u };
}
