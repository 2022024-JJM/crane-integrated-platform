import type {
  SavedCameraInfo,
  SavedMapInfo,
  SavedModelInfo,
  SavedSceneInfo,
  SavedTextInfo,
  ValueMapItem,
} from '@crane/domain/3d';
import { createId } from '@crane/core/lib/create-id';
import { clampToRange } from '@crane/core/lib/utils';
import type { Vector3Tuple } from '@crane/core/types/math';

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

  return clampToRange(Number(value), 0.1, 1);
}

export function sanitizeSceneInfo(sceneInfo: SavedSceneInfo): SavedSceneInfo {
  const seenIds = new Set<string>();

  const safeMap =
    sceneInfo?.map != null
      ? {
          id:
            typeof sceneInfo.map.id === 'string' && sceneInfo.map.id.length > 0
              ? sceneInfo.map.id
              : createSceneModelId(),
          path:
            typeof sceneInfo.map.path === 'string' &&
            sceneInfo.map.path.length > 0
              ? sceneInfo.map.path
              : '',
        }
      : null;

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

  const safeTexts = Array.isArray(sceneInfo?.texts)
    ? sceneInfo.texts.flatMap((text) => {
        if (
          !text ||
          typeof text.content !== 'string' ||
          typeof text.color !== 'string' ||
          !isVector3Tuple(text.position) ||
          !isVector3Tuple(text.rotation) ||
          !isVector3Tuple(text.scale)
        ) {
          return [];
        }

        let nextId =
          typeof text.id === 'string' && text.id.length > 0
            ? text.id
            : createSceneModelId();

        if (seenIds.has(nextId)) {
          nextId = createSceneModelId();
        }

        seenIds.add(nextId);

        return [{ ...text, id: nextId }];
      })
    : [];

  const safeCamera = sanitizeCamera(sceneInfo?.camera);

  return {
    map: safeMap,
    models: safeModels,
    texts: safeTexts,
    camera: safeCamera,
  };
}

function sanitizeCamera(
  camera: SavedCameraInfo | null | undefined,
): SavedCameraInfo | null {
  if (
    !camera ||
    !isVector3Tuple(camera.position) ||
    !isVector3Tuple(camera.target)
  ) {
    return null;
  }

  return {
    position: camera.position,
    target: camera.target,
  };
}

export function createSceneSnapshot(sceneInfo: SavedSceneInfo | null) {
  if (!sceneInfo) {
    return null;
  }

  return JSON.stringify(sanitizeSceneInfo(sceneInfo));
}

function isVector3TupleEqual(a: Vector3Tuple, b: Vector3Tuple): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function isValueMapListEqual(
  a: ValueMapItem[],
  b: ValueMapItem[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].type !== b[i].type || a[i].key !== b[i].key) return false;
  }
  return true;
}

function isMapInfoEqual(
  a: SavedMapInfo | null,
  b: SavedMapInfo | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.path === b.path;
}

function isTextInfoEqual(a: SavedTextInfo, b: SavedTextInfo): boolean {
  return (
    a.id === b.id &&
    a.content === b.content &&
    a.color === b.color &&
    isVector3TupleEqual(a.position, b.position) &&
    isVector3TupleEqual(a.rotation, b.rotation) &&
    isVector3TupleEqual(a.scale, b.scale)
  );
}

function isModelInfoEqual(a: SavedModelInfo, b: SavedModelInfo): boolean {
  return (
    a.id === b.id &&
    a.equipName === b.equipName &&
    a.craneId === b.craneId &&
    a.path === b.path &&
    a.opacity === b.opacity &&
    isVector3TupleEqual(a.position, b.position) &&
    isVector3TupleEqual(a.rotation, b.rotation) &&
    isVector3TupleEqual(a.scale, b.scale) &&
    isValueMapListEqual(a.valueMapList, b.valueMapList)
  );
}

export function isSceneInfoEqual(
  a: SavedSceneInfo | null,
  b: SavedSceneInfo | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (!isMapInfoEqual(a.map, b.map)) return false;
  if (!isCameraInfoEqual(a.camera ?? null, b.camera ?? null)) return false;
  if (a.models.length !== b.models.length) return false;
  for (let i = 0; i < a.models.length; i++) {
    if (!isModelInfoEqual(a.models[i], b.models[i])) return false;
  }
  const aTexts = a.texts ?? [];
  const bTexts = b.texts ?? [];
  if (aTexts.length !== bTexts.length) return false;
  for (let i = 0; i < aTexts.length; i++) {
    if (!isTextInfoEqual(aTexts[i], bTexts[i])) return false;
  }
  return true;
}

function isCameraInfoEqual(
  a: SavedCameraInfo | null,
  b: SavedCameraInfo | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    isVector3TupleEqual(a.position, b.position) &&
    isVector3TupleEqual(a.target, b.target)
  );
}
