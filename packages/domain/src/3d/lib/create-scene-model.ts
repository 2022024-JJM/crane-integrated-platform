import type { SceneModelCatalogItem, SavedModelInfo } from '../model/types';
import { createId } from '@crane/core/lib/create-id';

interface CreateSceneModelParams {
  catalogItem: SceneModelCatalogItem;
  position: [number, number, number];
}

export function createSceneModel({
  catalogItem,
  position,
}: CreateSceneModelParams): SavedModelInfo {
  return {
    id: createId(),
    equipName: catalogItem.label,
    path: catalogItem.path,
    opacity: 1,
    position,
    rotation: [0, 0, 0],
    scale: catalogItem.defaultScale,
    valueMapList: [],
    // true일 때만 실어 기존 저장본과의 diff를 최소화한다(locked과 같은 규칙).
    ...(catalogItem.floating ? { floating: true } : {}),
  };
}
