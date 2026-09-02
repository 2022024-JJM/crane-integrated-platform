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
  };
}
