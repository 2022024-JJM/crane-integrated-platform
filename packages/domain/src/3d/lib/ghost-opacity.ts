import type { Object3D } from 'three';

/**
 * 노드 미리보기의 고스트 — 인스펙터 노드 선택기가 하이라이트한 노드의
 * 서브트리만 원래 opacity 로 두고, 같은 모델의 나머지 메시는 흐리게 그린다.
 * ModelMesh 의 머티리얼 전이(개별 클론 경로)가 바인딩마다 이 값을 쓴다.
 */

/** `node` 가 `root` 자신이거나 그 자손인지 — 부모 체인을 따라 올라가 본다. */
export function isInsideSubtree(node: Object3D, root: Object3D): boolean {
  let current: Object3D | null = node;
  while (current) {
    if (current === root) return true;
    current = current.parent;
  }
  return false;
}

/**
 * 서브트리 안이면 `baseOpacity` 그대로, 밖이면 `baseOpacity × ghostOpacity`.
 * 결과는 [0, 1] 로 자른다.
 */
export function resolveGhostOpacity(
  baseOpacity: number,
  inside: boolean,
  ghostOpacity: number,
): number {
  const value = inside ? baseOpacity : baseOpacity * ghostOpacity;
  return Math.min(1, Math.max(0, value));
}
