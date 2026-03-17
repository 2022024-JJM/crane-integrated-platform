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
