import { useObjectFocusStore } from './use-object-focus-store';
import { useSceneInfoStore } from './use-scene-info-store';

interface CraneIdFromFocusedModel {
  craneId: string | null;
  craneName: string | null;
}

/**
 * 현재 3D 씬에서 포커스된 모델의 craneId와 equipName을 반환한다.
 * craneId가 없는 모델(지형, 맵 오브젝트 등)을 클릭한 경우 null을 반환한다.
 */
export function useCraneIdFromFocusedModel(
  regionId: string,
): CraneIdFromFocusedModel {
  const focusedModelId = useObjectFocusStore((s) => s.focusedModelId);
  const sceneInfo = useSceneInfoStore(
    (s) => s.sceneInfoByRegion[regionId] ?? null,
  );

  if (!focusedModelId || !sceneInfo) {
    return { craneId: null, craneName: null };
  }

  const model = sceneInfo.models.find((m) => m.id === focusedModelId);

  if (!model?.craneId) {
    return { craneId: null, craneName: null };
  }

  return { craneId: model.craneId, craneName: model.equipName };
}
