export { degToRad, numRound, radToDeg } from './lib/math-utils';
export { humanizeModelPath, normalizeModelLabel } from './lib/model-path-utils';
export { createSceneModel } from './lib/create-scene-model';
export { createSceneText } from './lib/create-scene-text';
export {
  loadSceneInfoByRegionId,
  saveSceneInfoByRegionId,
  isSceneStoredLocallyOnly,
  UnknownRegionError,
} from './lib/scene-dev-storage';
export { sanitizeSceneInfo } from './lib/sanitize-scene-info';
export {
  markSceneRegionActive,
  preloadGltf,
  releaseGltfCache,
  releaseSceneRegionAssets,
} from './lib/gltf-cache-release';
export { modelObjectRegistry } from './lib/model-object-registry';
export {
  prefetchModelBottomOffset,
  fillModelBottomOffsetFromClone,
  getModelBottomOffset,
} from './lib/model-bottom-offset-cache';
export { raycastMapSurfaceY } from './lib/map-surface-raycast';
export {
  makeMeshId,
  parseMeshId,
  isMeshId,
  getMeshPath,
  findMeshByPath,
} from './lib/mesh-path';
export type {
  SavedCameraInfo,
  SavedLightingInfo,
  SceneModelCatalogItem,
  SceneModelCategory,
  SceneModelPreviewPreset,
  SavedMapInfo,
  SavedMeshOverride,
  SavedModelInfo,
  SavedSceneInfo,
  SavedTextInfo,
  ValueMapItem,
  ValueMapType,
} from './model/types';
export {
  sceneEnvironmentCatalog,
  getSceneEnvironmentById,
  type SceneEnvironmentCatalogItem,
} from './model/scene-environment-catalog';
export {
  sceneMapCatalog,
  type SceneMapCatalogItem,
} from './model/scene-map-catalog';
export { sceneModelCatalog } from './model/scene-model-catalog';
export { SEA_LEVEL_Y } from './model/sea-level';
export {
  SCENE_MODEL_CATEGORIES,
  SCENE_SUN_AZIMUTH_DEFAULT,
  SCENE_SUN_ELEVATION_DEFAULT,
  SCENE_SUN_ELEVATION_MIN,
} from './model/types';
export {
  getSceneFileUrlByRegionId,
  getKnownRegionIds,
  isKnownRegionId,
} from './model/scene-file-registry';
export {
  getEnvironmentFileUrlByRegionId,
  resolveEnvironmentFileUrl,
} from './model/scene-environment-registry';
export { withBaseUrl, registerAssetHashManifest } from './lib/asset-url';
export {
  CRANE_TYPE_MODEL,
  getCraneModel,
} from './model/crane-type-model';
export type {
  CraneModelConfig,
  CraneModelCameraPreset,
} from './model/crane-type-model';
export { CRANE_ZONE_CONFIG, getCraneZoneConfig } from './model/crane-zone-config';
export type {
  CraneZone,
  CraneZoneConfig,
  CraneZonePart,
  CraneZoneRegion,
} from './model/crane-zone-config';
export { GltfModel } from './ui/gltf-model';
export { SceneText } from './ui/scene-text';
