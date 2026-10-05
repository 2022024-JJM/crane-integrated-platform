/**
 * 씬에 놓인 자산을 다른 버전으로 바꾼다 — 에디터의 "새 버전으로 갱신".
 *
 * 한 씬 안에서 한 자산은 한 버전이다: 그 자산을 가리키는 모델·지도·배경을
 * **전부** 한꺼번에 바꾼다. 바뀌는 것은 파일 경로와 버전뿐이고 배치·태그
 * 맵핑·영역은 그대로 둔다 — 새 파일의 노드 이름이나 원점이 달라졌는지는
 * 사용자가 화면에서 확인한다(되돌리기 한 번으로 돌아간다).
 */
import type { SavedSceneInfo, SceneAssetRef } from '../model/types';

function retarget<T extends { path: string; asset?: SceneAssetRef }>(
  item: T,
  assetId: string,
  version: number,
  path: string,
): T {
  if (item.asset?.id !== assetId) return item;
  if (item.asset.version === version && item.path === path) return item;
  return { ...item, path, asset: { id: assetId, version } };
}

/** 하나도 바뀌지 않았으면 입력 배열을 그대로 돌려준다. */
function retargetAll<T extends { path: string; asset?: SceneAssetRef }>(
  items: T[],
  assetId: string,
  version: number,
  path: string,
): T[] {
  let changed = false;
  const next = items.map((item) => {
    const updated = retarget(item, assetId, version, path);
    if (updated !== item) changed = true;
    return updated;
  });
  return changed ? next : items;
}

/**
 * `assetId` 를 가리키는 객체를 전부 `version`(`path`)으로 옮긴다. 바뀐 것이
 * 없으면 **같은 참조**를 돌려준다 — 히스토리와 dirty 가 헛돌지 않는다.
 */
export function withSceneAssetVersion(
  scene: SavedSceneInfo,
  assetId: string,
  version: number,
  path: string,
): SavedSceneInfo {
  if (!assetId || !path) return scene;
  const models = retargetAll(scene.models, assetId, version, path);
  const maps = retargetAll(scene.maps, assetId, version, path);
  const environment = scene.environment
    ? retarget(scene.environment, assetId, version, path)
    : undefined;
  if (
    models === scene.models &&
    maps === scene.maps &&
    environment === scene.environment
  ) {
    return scene;
  }
  return {
    ...scene,
    models,
    maps,
    ...(environment ? { environment } : {}),
  };
}
