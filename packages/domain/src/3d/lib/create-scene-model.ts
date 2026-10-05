import type { ScenePlaceableModel, SavedModelInfo } from '../model/types';
import { createId } from '@crane/core/lib/create-id';

interface CreateSceneModelParams {
  /** 팔레트에서 고른 자산 — 경로와 자산 참조가 씬에 적힌다. */
  model: ScenePlaceableModel;
  position: [number, number, number];
}

export function createSceneModel({
  model,
  position,
}: CreateSceneModelParams): SavedModelInfo {
  return {
    id: createId(),
    equipName: model.label,
    path: model.path,
    asset: { id: model.id, version: model.version },
    opacity: 1,
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}
