import type { BufferGeometry, Mesh } from 'three';

/**
 * 평면도 채움(ObjectPlanFill, 현재 미사용)의 메쉬 예산 — 채움은 메쉬 geometry
 * 를 한 번 더 그리므로 큰 메쉬일수록 비싸다. 두꺼운 몸체(골리앗 거더·OC 베이스,
 * 수만 삼각형)는 위에서 봐도 넓어 채움이 필요 없다 — 얇은 부재가 반짝이는 것은
 * 격자 지브·마스트 같은 중간 크기 메쉬다. 그래서 삼각형 수가 상한을 넘는 메쉬는
 * 채움에서 뺀다. 숨은선(plan-hidden-line.ts)은 이 예산을 쓰지 않는다 — 표식이
 * 빠진 메쉬는 그 아래 자기 부재를 고스트로 만든다.
 */
export const PLAN_OVERLAY_MAX_TRIANGLES = 60_000;

/** geometry 의 삼각형 수(인덱스가 있으면 인덱스 기준). 정점이 없으면 0. */
export function geometryTriangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  if (index) return Math.floor(index.count / 3);
  const position = geometry.getAttribute('position');
  return position ? Math.floor(position.count / 3) : 0;
}

/** 이 메쉬에 채움을 붙일지. LOD 사본은 호출자가 먼저 거른다. */
export function isPlanOverlayEligible(
  mesh: Mesh,
  maxTriangles: number = PLAN_OVERLAY_MAX_TRIANGLES,
): boolean {
  return geometryTriangleCount(mesh.geometry) <= maxTriangles;
}
