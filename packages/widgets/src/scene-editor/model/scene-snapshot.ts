import type {
  SavedCameraInfo,
  SavedCameraSensorInfo,
  SavedLidarSensorInfo,
  SavedMapInfo,
  SavedMeshOverride,
  SavedModelInfo,
  SavedSceneInfo,
  SavedSensorInfo,
  SavedTextInfo,
  ValueMapItem,
} from '@crane/domain/3d';
import {
  normalizeCameraSettings,
  normalizeLidarSettings,
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

function sanitizeMeshOverrides(
  raw: unknown,
): SavedMeshOverride[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SavedMeshOverride[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.meshPath !== 'string' || o.meshPath.length === 0) continue;
    const sanitized: SavedMeshOverride = { meshPath: o.meshPath };
    if (isVector3Tuple(o.position)) sanitized.position = o.position as Vector3Tuple;
    if (isVector3Tuple(o.rotation)) sanitized.rotation = o.rotation as Vector3Tuple;
    if (isVector3Tuple(o.scale)) sanitized.scale = o.scale as Vector3Tuple;
    if (isFiniteNumber(o.opacity))
      sanitized.opacity = clampToRange(Number(o.opacity), 0.1, 1);
    if (typeof o.visible === 'boolean') sanitized.visible = o.visible;
    if (typeof o.name === 'string') sanitized.name = o.name;
    out.push(sanitized);
  }
  return out.length > 0 ? out : undefined;
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
            meshOverrides: sanitizeMeshOverrides(model.meshOverrides),
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

  const safeSensors = sanitizeSensors(sceneInfo?.sensors, seenIds);
  const safeCamera = sanitizeCamera(sceneInfo?.camera);

  return {
    map: safeMap,
    models: safeModels,
    texts: safeTexts,
    sensors: safeSensors,
    camera: safeCamera,
  };
}

function sanitizeSensors(
  raw: unknown,
  seenIds: Set<string>,
): SavedSensorInfo[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SavedSensorInfo[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const sensor = item as Record<string, unknown>;
    if (
      typeof sensor.type !== 'string' ||
      (sensor.type !== 'lidar' && sensor.type !== 'camera')
    ) {
      continue;
    }
    if (
      !isVector3Tuple(sensor.position) ||
      !isVector3Tuple(sensor.rotation)
    ) {
      continue;
    }
    let nextId =
      typeof sensor.id === 'string' && sensor.id.length > 0
        ? sensor.id
        : createSceneModelId();
    if (seenIds.has(nextId)) nextId = createSceneModelId();
    seenIds.add(nextId);

    const name = typeof sensor.name === 'string' ? sensor.name : '';

    if (sensor.type === 'lidar') {
      const normalized = normalizeLidarSettings({
        horizontalFov: Number(sensor.horizontalFov),
        verticalFov: Number(sensor.verticalFov),
        far: Number(sensor.far),
        horizontalSegments: Number(sensor.horizontalSegments),
        verticalSegments: Number(sensor.verticalSegments),
        pointSize: Number(sensor.pointSize),
      });
      const lidar: SavedLidarSensorInfo = {
        id: nextId,
        type: 'lidar',
        name: name || 'LiDAR',
        position: sensor.position as Vector3Tuple,
        rotation: sensor.rotation as Vector3Tuple,
        ...normalized,
      };
      out.push(lidar);
      continue;
    }

    const normalized = normalizeCameraSettings({
      horizontalFov: Number(sensor.horizontalFov),
      verticalFov: Number(sensor.verticalFov),
      near: Number(sensor.near),
      far: Number(sensor.far),
      frustumSegmentsX: Number(sensor.frustumSegmentsX),
      frustumSegmentsY: Number(sensor.frustumSegmentsY),
    });
    const camera: SavedCameraSensorInfo = {
      id: nextId,
      type: 'camera',
      name: name || 'Camera',
      position: sensor.position as Vector3Tuple,
      rotation: sensor.rotation as Vector3Tuple,
      ...normalized,
    };
    out.push(camera);
  }
  return out.length > 0 ? out : undefined;
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

function isValueMapListEqual(a: ValueMapItem[], b: ValueMapItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].type !== b[i].type ||
      a[i].key !== b[i].key ||
      (a[i].scale ?? 1) !== (b[i].scale ?? 1) ||
      (a[i].offset ?? 0) !== (b[i].offset ?? 0)
    ) return false;
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

function isSensorInfoEqual(a: SavedSensorInfo, b: SavedSensorInfo): boolean {
  if (a.id !== b.id) return false;
  if (a.type !== b.type) return false;
  if (a.name !== b.name) return false;
  if (!isVector3TupleEqual(a.position, b.position)) return false;
  if (!isVector3TupleEqual(a.rotation, b.rotation)) return false;
  if (a.type === 'lidar' && b.type === 'lidar') {
    return (
      a.horizontalFov === b.horizontalFov &&
      a.verticalFov === b.verticalFov &&
      a.far === b.far &&
      a.horizontalSegments === b.horizontalSegments &&
      a.verticalSegments === b.verticalSegments &&
      a.pointSize === b.pointSize
    );
  }
  if (a.type === 'camera' && b.type === 'camera') {
    return (
      a.horizontalFov === b.horizontalFov &&
      a.verticalFov === b.verticalFov &&
      a.near === b.near &&
      a.far === b.far &&
      a.frustumSegmentsX === b.frustumSegmentsX &&
      a.frustumSegmentsY === b.frustumSegmentsY
    );
  }
  return false;
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

function isMeshOverrideEqual(
  a: SavedMeshOverride,
  b: SavedMeshOverride,
): boolean {
  if (a.meshPath !== b.meshPath) return false;
  if (a.opacity !== b.opacity) return false;
  if (a.visible !== b.visible) return false;
  if (a.name !== b.name) return false;
  const vecKeys: (keyof Pick<
    SavedMeshOverride,
    'position' | 'rotation' | 'scale'
  >)[] = ['position', 'rotation', 'scale'];
  for (const k of vecKeys) {
    const av = a[k];
    const bv = b[k];
    if (!av && !bv) continue;
    if (!av || !bv) return false;
    if (!isVector3TupleEqual(av, bv)) return false;
  }
  return true;
}

function isMeshOverrideListEqual(
  a: SavedMeshOverride[] | undefined,
  b: SavedMeshOverride[] | undefined,
): boolean {
  const aLen = a?.length ?? 0;
  const bLen = b?.length ?? 0;
  if (aLen !== bLen) return false;
  if (aLen === 0) return true;
  // 순서 무관 비교: meshPath 기준 lookup
  const bMap = new Map((b ?? []).map((o) => [o.meshPath, o]));
  for (const ao of a ?? []) {
    const bo = bMap.get(ao.meshPath);
    if (!bo) return false;
    if (!isMeshOverrideEqual(ao, bo)) return false;
  }
  return true;
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
    isValueMapListEqual(a.valueMapList, b.valueMapList) &&
    isMeshOverrideListEqual(a.meshOverrides, b.meshOverrides)
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
  const aSensors = a.sensors ?? [];
  const bSensors = b.sensors ?? [];
  if (aSensors.length !== bSensors.length) return false;
  for (let i = 0; i < aSensors.length; i++) {
    if (!isSensorInfoEqual(aSensors[i], bSensors[i])) return false;
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
