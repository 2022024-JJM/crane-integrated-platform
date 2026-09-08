import { normalizeDegrees, numRound } from '@crane/domain/3d';
import { ROTATION_DECIMALS } from './vector-edit';

/**
 * 인스펙터 회전 입력의 표시 숫자 — 소수점 첫째자리로 반올림. 반올림 후
 * wrap 순서가 중요하다 — numRound(359.96, 1)=360 이 되므로 wrap 을
 * 나중에 해야 360 표시가 안 생긴다.
 */
export function displayRotationValue(deg: number): number {
  return normalizeDegrees(numRound(deg, ROTATION_DECIMALS));
}

/** 회전 표시 텍스트: "330°" */
export function formatRotation(deg: number): string {
  return `${displayRotationValue(deg)}°`;
}

/** 위치 표시 텍스트: "1.5 m" */
export function formatPosition(v: number): string {
  return `${Number.isFinite(v) ? numRound(v) : 0} m`;
}

/** 크기 표시 텍스트: 소수점 3자리 고정("1.000") */
export function formatScale(v: number): string {
  return (Number.isFinite(v) ? numRound(v) : 0).toFixed(3);
}
