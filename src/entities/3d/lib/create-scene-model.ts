import type { SceneModelCatalogItem, SavedModelInfo } from '../model/types';

interface CreateSceneModelParams {
  catalogItem: SceneModelCatalogItem;
  position: [number, number, number];
}

export function createSceneModel({
  catalogItem,
  position,
}: CreateSceneModelParams): SavedModelInfo {
  return {
    id: crypto.randomUUID(),
    equipName: catalogItem.label,
    path: catalogItem.path,
    position,
    rotation: [0, 0, 0],
    scale: catalogItem.defaultScale,
    valueMapList: [],
  };
}
