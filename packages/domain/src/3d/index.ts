export {
  degToRad,
  normalizeDegrees,
  numRound,
  radToDeg,
} from './lib/math-utils';
export { resolveEulerContinuity } from './lib/euler-continuity';
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
  sanitizeModelRigId,
  sanitizeRigDefinition,
  sanitizeRigDefinitions,
} from './lib/sanitize-rig';
export {
  convertLegacyRigBindings,
  convertLegacyValueMapList,
  resolveModelTagMappings,
  sanitizeTagMappings,
} from './lib/sanitize-tag-mappings';
export {
  getRigOccupiedTargetKeys,
  getTagMappingTargetKey,
  getTagMappingUnit,
  TAG_MAPPING_CHANNELS,
} from './model/tag-mapping-types';
export type {
  TagMapping,
  TagMappingChannel,
  TagMappingJointTarget,
  TagMappingNodeTarget,
  TagMappingTarget,
  TagMappingUnit,
} from './model/tag-mapping-types';
export {
  getDrivenJointIds,
  getRigJointUnit,
  RIG_AXES,
  RIG_CONSTRAINT_TYPES,
  RIG_HINGE_DEFAULT_RANGE,
  RIG_JOINT_TYPES,
  RIG_SLIDE_DEFAULT_RANGE,
} from './model/rig-types';
export type {
  RigAxis,
  RigBinding,
  RigConstraint,
  RigConstraintType,
  RigDefinition,
  RigJoint,
  RigJointType,
  RigJointUnit,
  RigLinearConstraint,
  RigNodePath,
} from './model/rig-types';
export {
  markSceneRegionActive,
  preloadGltf,
  releaseGltfCache,
  releaseSceneRegionAssets,
} from './lib/gltf-cache-release';
export { modelObjectRegistry } from './lib/model-object-registry';
export { extendGltfLoaderWithKtx2 } from './lib/ktx2-loader';
export {
  invalidateShadows,
  registerShadowRenderer,
  unregisterShadowRenderer,
} from './lib/shadow-invalidation';
export { bvhBuildQueue, createBvhBuildQueue } from './lib/bvh-build-queue';
export type {
  BvhBuildCounts,
  BvhBuildOptions,
  BvhBuildQueue,
  BvhBuildScheduler,
  BvhBuildSnapshot,
} from './lib/bvh-build-queue';
export {
  approxContactPoint,
  boxesSeparated,
  collectCollidableMeshes,
  hasBoundsTree,
  isCollidableMesh,
  meshesIntersectExact,
  meshesWithinDistance,
  meshObbsIntersect,
  meshWorldBox,
} from './lib/collision-volumes';
export {
  COLLISION_LINE_COLOR,
  COLLISION_LINE_WIDTH,
} from './lib/selection-style';
export {
  capturePose,
  getRestPose,
  hasRestPose,
  resetToRestPose,
  seedRestPose,
  type RestPose,
} from './lib/rest-pose-cache';
export {
  prefetchModelBottomOffset,
  fillModelBottomOffsetFromClone,
  getModelBottomOffset,
} from './lib/model-bottom-offset-cache';
export { raycastMapSurfaceY } from './lib/map-surface-raycast';
export { toLambertMaterial, toLambertMaterials } from './lib/lambert-material';
export { resolveGroundMaps } from './lib/resolve-ground-map';
export {
  collectCameraBoundsBox,
  resolveCameraBoundsMaps,
  unionObjectBounds,
} from './lib/camera-bounds-maps';
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
  getSceneMapCatalogItemByPath,
  type SceneMapCatalogItem,
  type SceneMapKind,
} from './model/scene-map-catalog';
export { sceneModelCatalog } from './model/scene-model-catalog';
export { SEA_LEVEL_Y } from './model/sea-level';
export {
  SCENE_MODEL_CATEGORIES,
  SCENE_SUN_AZIMUTH_DEFAULT,
  SCENE_SUN_ELEVATION_DEFAULT,
  SCENE_SUN_ELEVATION_MIN,
  SCENE_SUN_MODE_DEFAULT,
} from './model/types';
export type { SceneSunMode } from './model/types';
export {
  SCENE_SITE_GEO_BY_REGION_ID,
  getSceneSiteGeo,
  type SceneSiteGeo,
} from './model/scene-site-geo';
export {
  SUN_HORIZON_ELEVATION,
  computeMoonIllumination,
  computeMoonPosition,
  computeSunDayEvents,
  computeSunPosition,
  type CelestialPosition,
  type MoonIllumination,
  type MoonPosition,
  type SunDayEvents,
} from './lib/solar-position';
export {
  getSceneFileUrlByRegionId,
  getKnownRegionIds,
  isKnownRegionId,
} from './model/scene-file-registry';
export {
  getEnvironmentFileUrlByRegionId,
  resolveEnvironmentFileUrl,
} from './model/scene-environment-registry';
export {
  withBaseUrl,
  registerAssetHashManifest,
} from '@crane/core/lib/asset-url';
export { getModelPreviewAssetPath } from './lib/preview-asset-path';
export { CRANE_TYPE_MODEL, getCraneModel } from './model/crane-type-model';
export type {
  CraneModelConfig,
  CraneModelCameraPreset,
} from './model/crane-type-model';
export {
  CRANE_ZONE_CONFIG,
  getCraneZoneConfig,
} from './model/crane-zone-config';
export type {
  CraneZone,
  CraneZoneConfig,
  CraneZonePart,
  CraneZoneRegion,
} from './model/crane-zone-config';
export { GltfModel } from './ui/gltf-model';
export type { ModelShading } from './ui/model-mesh';
export { ModelSelectionBox } from './ui/model-selection-box';
export { ObjectSilhouetteOutline } from './ui/object-silhouette-outline';
export { SilhouetteOutlineWarmup } from './ui/silhouette-outline-warmup';
export {
  SILHOUETTE_OUTLINE_PX,
  outlineOffsetFactor,
} from './lib/silhouette-outline';
export {
  SCENE_OPAQUE_STENCIL_BIT,
  SILHOUETTE_STENCIL_BIT,
  hasSceneOpaqueStencil,
  markSceneOpaqueStencil,
  markSceneOpaqueStencils,
} from './lib/scene-stencil';
export { SceneText } from './ui/scene-text';
