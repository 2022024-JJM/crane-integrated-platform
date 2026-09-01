import { MathUtils } from 'three';

export function numRound(num: number, fix: number = 3): number {
  return Number(num.toFixed(fix));
}

export function degToRad(num: number): number {
  return MathUtils.degToRad(num);
}

export function radToDeg(num: number): number {
  return MathUtils.radToDeg(num);
}

/** 각도를 [0,360) 범위로 wrap한다. 비유한값(NaN/±Infinity)은 0으로 방어한다. */
export function normalizeDegrees(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  // 이중 mod(((deg%360)+360)%360)는 이미 범위 안인 값에도 부동소수점
  // 오차를 만든다 (45.7 → 45.69999999999999). 음수일 때만 +360 한다.
  const wrapped = deg % 360;
  const shifted = wrapped < 0 ? wrapped + 360 : wrapped;
  // 0에 극히 가까운 음수는 +360이 부동소수점상 정확히 360으로 붙을 수 있다.
  if (shifted === 360) return 0;
  // -0 → +0 (-0 === 0 이므로 이 분기가 -0 을 걸러낸다)
  return shifted === 0 ? 0 : shifted;
}
