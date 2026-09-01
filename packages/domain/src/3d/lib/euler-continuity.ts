import type { Vector3Tuple } from '@crane/core/types/math';

/** v를 prev에 가장 가까운 360° 등가각으로 옮긴다. */
function nearestEquivalentAngle(v: number, prev: number): number {
  return v + 360 * Math.round((prev - v) / 360);
}

function distanceTo(prev: Vector3Tuple, candidate: Vector3Tuple): number {
  return (
    Math.abs(candidate[0] - prev[0]) +
    Math.abs(candidate[1] - prev[1]) +
    Math.abs(candidate[2] - prev[2])
  );
}

/**
 * three.js 의 Euler(XYZ) 추출(`Euler.setFromQuaternion`)은 y를 asin 치역
 * [-90,90]으로 제한하므로 같은 자세가 두 표현을 가진다:
 * (x, y, z) ≡ (x+180, 180-y, z+180). 기즈모로 y를 90° 너머로 돌리면
 * three 는 후자로 건너뛰어 "x/z가 0에서 180으로 튀는" 값이 나온다.
 *
 * 드래그 연속성 기준(prevDeg — 직전 프레임 또는 드래그 시작 시점의 euler deg)
 * 에서 각도 거리가 가까운 표현을 골라 돌려준다. 각 축은 prev 최근접 360°
 * 등가각으로 조정한 연속 값이므로 [0,360) wrap 은 호출부(커밋)가 한다.
 */
export function resolveEulerContinuity(
  prevDeg: Vector3Tuple,
  currentDeg: Vector3Tuple,
): Vector3Tuple {
  if (
    !prevDeg.every((v) => Number.isFinite(v)) ||
    !currentDeg.every((v) => Number.isFinite(v))
  ) {
    return currentDeg;
  }

  const [x, y, z] = currentDeg;
  const candidates: Vector3Tuple[] = [currentDeg, [x + 180, 180 - y, z + 180]];

  let best = currentDeg;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const adjusted = candidate.map((v, i) =>
      nearestEquivalentAngle(v, prevDeg[i]),
    ) as Vector3Tuple;
    const distance = distanceTo(prevDeg, adjusted);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = adjusted;
    }
  }
  return best;
}
