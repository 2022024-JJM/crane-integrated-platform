import type { SavedSceneInfo } from '../model/types';
import { parseMeshId } from './mesh-path';

/** 안쪽 노드를 가진 씬 객체의 종류 — GLB 를 로드하는 모델과 지도뿐이다. */
export type SceneNodeParentKind = 'model' | 'map';

export interface SceneNodeParent {
  kind: SceneNodeParentKind;
  /** 부모 객체 id — 노드 id(`${id}::${meshPath}`)의 앞부분. */
  id: string;
  /** 부모 clone root 기준 노드 경로(mesh-path.ts 형식). */
  meshPath: string;
}

/**
 * 안쪽 노드 id 의 부모 객체를 씬에서 찾는다. 노드 id 형식이 아니거나 부모가
 * 씬의 모델·지도에 없으면 null — 선택 유지 판정·F 포커스가 이 결과 하나로
 * 부모를 확인한다. 객체 id 는 종류를 가리지 않고 전역 고유라(sanitizeSceneInfo
 * 의 seenIds) 모델을 먼저 보고 지도를 본다.
 */
export function resolveSceneNodeParent(
  scene: Pick<SavedSceneInfo, 'models' | 'maps'>,
  nodeId: string,
): SceneNodeParent | null {
  const parsed = parseMeshId(nodeId);
  if (!parsed) return null;
  const { modelId: id, meshPath } = parsed;
  if ((scene.models ?? []).some((model) => model.id === id)) {
    return { kind: 'model', id, meshPath };
  }
  if ((scene.maps ?? []).some((map) => map.id === id)) {
    return { kind: 'map', id, meshPath };
  }
  return null;
}
