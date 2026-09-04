import type { SceneSnapStep } from '@crane/features/3d';

/**
 * 스냅 단위 표시 문자열. 툴팁·드롭다운 항목이 같은 표기를
 * 쓴다. 값 검증은 snap-storage 의 sanitize 몫이라 여기서는 어떤 숫자든
 * 그대로 포맷한다.
 */

const RAD_TO_DEG = 180 / Math.PI;

/** 1 → "1", 0.25 → "0.25", 0.1 + 0.2 → "0.3" — 표시용 소수 정리. */
function trimNumber(value: number, digits = 3): string {
  return Number(value.toFixed(digits)).toString();
}

export function formatSnapTranslation(meters: number): string {
  return `${trimNumber(meters)}m`;
}

export function formatSnapRotation(radians: number): string {
  return `${trimNumber(radians * RAD_TO_DEG, 1)}°`;
}

export function formatSnapScale(scale: number): string {
  return trimNumber(scale);
}

/** `1m · 15° · 0.1` */
export function formatSnapStep(step: SceneSnapStep): string {
  return [
    formatSnapTranslation(step.translation),
    formatSnapRotation(step.rotation),
    formatSnapScale(step.scale),
  ].join(' · ');
}
