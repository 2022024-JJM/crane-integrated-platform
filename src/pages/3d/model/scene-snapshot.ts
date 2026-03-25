import type { SavedSceneInfo } from '@/entities/3d';
import { createId } from '@/shared/lib/create-id';

function createSceneModelId() {
  return createId();
}

function isFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isVector3Tuple(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => isFiniteNumber(item))
  );
}

function clampOpacity(value: unknown) {
  if (!isFiniteNumber(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0.1, Number(value)));
}

export function sanitizeSceneInfo(sceneInfo: SavedSceneInfo): SavedSceneInfo {
  const seenIds = new Set<string>();

  const safeMap = {
    id:
      typeof sceneInfo?.map?.id === 'string' && sceneInfo.map.id.length > 0
        ? sceneInfo.map.id
        : createSceneModelId(),
    path:
      typeof sceneInfo?.map?.path === 'string' && sceneInfo.map.path.length > 0
        ? sceneInfo.map.path
        : '',
  };

  const safeModels = Array.isArray(sceneInfo?.models)
    ? sceneInfo.models.flatMap((model) => {
        if (
          !model ||
          typeof model.path !== 'string' ||
          model.path.length === 0 ||
          typeof model.equipName !== 'string' ||
          !isVector3Tuple(model.position) ||
          !isVector3Tuple(model.rotation) ||
          !isVector3Tuple(model.scale) ||
          !Array.isArray(model.valueMapList)
        ) {
          return [];
        }

        let nextId =
          typeof model.id === 'string' && model.id.length > 0
            ? model.id
            : createSceneModelId();

        if (seenIds.has(nextId)) {
          nextId = createSceneModelId();
        }

        seenIds.add(nextId);

        return [
          {
            ...model,
            id: nextId,
            opacity: clampOpacity(model.opacity),
          },
        ];
      })
    : [];

  return {
    map: safeMap,
    models: safeModels,
  };
}

export function createSceneSnapshot(sceneInfo: SavedSceneInfo | null) {
  if (!sceneInfo) {
    return null;
  }

  return JSON.stringify(sanitizeSceneInfo(sceneInfo));
}
