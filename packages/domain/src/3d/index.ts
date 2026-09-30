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
export { createSceneRuler } from './lib/create-scene-ruler';
export {
  formatRulerValue,
  isRulerLabelVisible,
  pickRulerInterval,
  pixelsPerUnitAtDistance,
  resolveRulerInterval,
  rulerAxisPoints,
  rulerDotCenterPx,
  rulerDotSizePx,
  rulerGuidePoints,
  rulerLabelMinSpacingPx,
  rulerLabelStride,
  rulerPlacementFromPoints,
  rulerTextSizePx,
  rulerTicks,
  RULER_DOT_SIZE_PX,
  RULER_MAX_TICKS,
  RULER_TEXT_SIZE_PX,
  type RulerPlacement,
  type RulerTick,
} from './lib/ruler';
export { sanitizeRulerFields, sanitizeRulerGuide } from './lib/sanitize-rulers';
export {
  isLabelInRange,
  labelScaleAtDistance,
  LABEL_MIN_SCALE,
  LABEL_SCALE_REF_DISTANCE,
  LABEL_VISIBILITY_DISTANCE,
} from './lib/label-scale';
export {
  isRulerInterval,
  isRulerSize,
  RULER_DEFAULT_COLOR,
  RULER_GUIDE_DEFAULT_LENGTH_M,
  RULER_GUIDE_OPACITY_DEFAULT,
  RULER_GUIDE_OPACITY_MIN,
  RULER_GUIDE_SIDE_DEFAULT,
  RULER_GUIDE_SIDES,
  RULER_INTERVAL_DEFAULT,
  RULER_INTERVALS,
  RULER_MIN_LENGTH,
  RULER_SIZE_DEFAULT,
  RULER_SIZES,
} from './model/ruler-types';
export type {
  SavedRulerGuide,
  SavedRulerInfo,
  SceneRulerGuideSide,
  SceneRulerInterval,
  SceneRulerSize,
} from './model/ruler-types';
export {
  buildLabelReadings,
  formatLabelReading,
  LABEL_READING_EMPTY,
} from './lib/label-reading';
export type {
  ModelLabelReading,
  ModelLabelValueReader,
} from './lib/label-reading';
export {
  loadSceneInfoByRegionId,
  saveSceneInfoByRegionId,
  isSceneStoredLocallyOnly,
  UnknownRegionError,
} from './lib/scene-dev-storage';
export { PerViewport, ViewportAnchor } from './ui/scene-viewports';
export {
  SceneViewportsProvider,
  useSceneViewportHeight,
  useSceneViewports,
  type SceneViewport,
} from './model/scene-viewports-context';
export { sanitizeSceneInfo } from './lib/sanitize-scene-info';
export {
  sanitizeSceneViews,
  sanitizeViewSplit,
  sceneViewNameKey,
} from './lib/sanitize-views';
export {
  resolveSplitLayout,
  splitSlotPosition,
  type SplitLayout,
  type SplitTile,
} from './lib/view-split-layout';
export {
  createEmptySplitSlots,
  SCENE_SPLIT_COLUMNS,
  SCENE_SPLIT_SLOT_COUNT,
  SCENE_VIEW_NAME_MAX,
  SCENE_VIEWS_MAX,
} from './model/view-types';
export type { SavedSceneView, SavedViewSplit } from './model/view-types';
export {
  resolveSceneCameraForRegion,
  withRegionCamera,
} from './lib/scene-region-camera';
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
  TAG_MAPPING_CAPTION_MAX,
  TAG_MAPPING_CHANNELS,
} from './model/tag-mapping-types';
export { sanitizeModelStatusTags } from './lib/sanitize-status-tags';
export {
  LABEL_STATUS_TAG_ROLES,
  OUTLINE_STATUS_TAG_ROLES,
  STATUS_TAG_ROLES,
} from './model/status-tag-types';
export type {
  ModelStatusTags,
  OutlineStatusTagRole,
  StatusTagRole,
} from './model/status-tag-types';
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
  circleIntersectsBoxXZ,
  isValidZoneRadius,
  meshIntersectsVerticalCylinder,
  pointInCircleXZ,
  segmentDistanceSqXZ,
  triangleIntersectsCircleXZ,
  zoneCenterWorld,
} from './lib/zone-volumes';
export {
  DEFAULT_ZONE_COLOR,
  normalizeZoneColor,
  sanitizeModelZones,
  sanitizeZoneOffset,
} from './lib/sanitize-model-zones';
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
export {
  raycastMapSurfaceY,
  sampleMapsSurfaceY,
} from './lib/map-surface-raycast';
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
  SavedModelZone,
  SavedModelZoneLevel,
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
  SCENE_TRUE_NORTH_DEFAULT,
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
export { resolveSeaVisible } from './lib/scene-sea';
export { bearingToWorldAzimuth, resolveTrueNorth } from './lib/true-north';
export {
  buildSeaReachMask,
  type SeaReachMask,
  type SeaReachSource,
} from './lib/sea-reach-mask';
export {
  getSeaReachSignature,
  publishSeaReachMask,
  resetSeaReachMask,
} from './lib/sea-reach-uniforms';
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
export type { ModelLabelTitles } from './ui/model-label';
export type { ModelShading } from './ui/model-mesh';
export { ModelSelectionBox } from './ui/model-selection-box';
export { ObjectSilhouetteOutline } from './ui/object-silhouette-outline';
export { SilhouetteOutlineWarmup } from './ui/silhouette-outline-warmup';
export {
  SILHOUETTE_OUTLINE_PX,
  SILHOUETTE_OUTLINE_RENDER_ORDER,
  outlineOffsetFactor,
} from './lib/silhouette-outline';
export {
  STATUS_OUTLINE_COLORS,
  STATUS_OUTLINE_PX,
  isStatusOutlineVisible,
  statusOutlineRenderOrder,
  type StatusOutlineKind,
} from './lib/status-outline-style';
export {
  SCENE_OPAQUE_STENCIL_BIT,
  SILHOUETTE_STENCIL_BIT,
  hasSceneOpaqueStencil,
  markSceneOpaqueStencil,
  markSceneOpaqueStencils,
} from './lib/scene-stencil';
export { SceneText } from './ui/scene-text';
export { SceneRuler, SceneRulerPreview } from './ui/scene-ruler';
export {
  SCENE_METERS_PER_UNIT_BY_REGION_ID,
  getSceneMetersPerUnit,
} from './model/scene-unit-scale';
