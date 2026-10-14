/**
 * 상시 윤곽(contour)의 거리 컬링 — 카메라에서 CONTOUR_MAX_DISTANCE_M 안의
 * 장비만 윤곽을 받는다. 윤곽은 장비마다 스텐실 패스라 수가 비용이고, 멀리
 * 있는 장비는 어차피 몇 픽셀이라 윤곽이 형태를 더해 주지 않는다.
 */
export const CONTOUR_MAX_DISTANCE_M = 900;
/** 판정 주기(ms) — 카메라가 움직여도 이 주기면 눈에 띄지 않는다. */
export const CONTOUR_CULL_INTERVAL_MS = 500;

export interface ContourCandidate {
  id: string;
  /** 카메라까지의 거리(씬 unit). */
  distance: number;
}

/** 거리(unit) 가 상한(m → unit) 이하인 id 를 입력 순서대로. */
export function selectContourIds(
  candidates: readonly ContourCandidate[],
  metersPerUnit: number,
  maxDistanceM: number = CONTOUR_MAX_DISTANCE_M,
): string[] {
  const mpu = metersPerUnit > 0 ? metersPerUnit : 1;
  const limit = maxDistanceM / mpu;
  const out: string[] = [];
  for (const c of candidates) {
    if (Number.isFinite(c.distance) && c.distance <= limit) out.push(c.id);
  }
  return out;
}

export function isSameIdList(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}
