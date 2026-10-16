import type { BufferGeometry, Mesh } from 'three';

/**
 * 평면도 오버레이(채움·숨은선)의 메쉬 예산 — 두 오버레이는 메쉬 geometry 를
 * 1~3번 더 그리므로 큰 메쉬일수록 비싸다. 두꺼운 몸체(골리앗 거더·OC 베이스,
 * 수만 삼각형)는 위에서 봐도 넓어 채움이 필요 없고, 가려질 일도 드물다 —
 * 얇은 부재가 반짝이는 것은 격자 지브·마스트 같은 중간 크기 메쉬다. 그래서
 * 삼각형 수가 상한을 넘는 메쉬는 두 오버레이에서 뺀다.
 */
export const PLAN_OVERLAY_MAX_TRIANGLES = 60_000;

/** geometry 의 삼각형 수(인덱스가 있으면 인덱스 기준). 정점이 없으면 0. */
export function geometryTriangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  if (index) return Math.floor(index.count / 3);
  const position = geometry.getAttribute('position');
  return position ? Math.floor(position.count / 3) : 0;
}

/** 이 메쉬에 채움·숨은선을 붙일지. LOD 사본은 호출자가 먼저 거른다. */
export function isPlanOverlayEligible(
  mesh: Mesh,
  maxTriangles: number = PLAN_OVERLAY_MAX_TRIANGLES,
): boolean {
  return geometryTriangleCount(mesh.geometry) <= maxTriangles;
}
