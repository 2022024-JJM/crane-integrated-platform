export type {
  AssetCollection,
  AssetFile,
  AssetFileRef,
  AssetHistoryAction,
  AssetHistoryEntry,
  AssetKind,
  AssetLibraryDocument,
  AssetMapRole,
  AssetPlacement,
  AssetRecord,
  AssetStats,
  AssetStatsTable,
  AssetStatsTableEntry,
  AssetThumbnail,
  AssetVersion,
  AssetVersionStatus,
} from './model/types';
export {
  ASSET_COLLECTION_NAME_MAX,
  ASSET_COLLECTIONS_MAX,
  ASSET_DESCRIPTION_MAX,
  ASSET_DRAWING_NO_MAX,
  ASSET_KINDS,
  ASSET_LIBRARY_SCHEMA_VERSION,
  ASSET_MAP_ROLES,
  ASSET_NAME_MAX,
  ASSET_NOTE_MAX,
  ASSET_OWNER_MAX,
  ASSET_REVISION_MAX,
  ASSET_CATEGORY_MAX,
  ASSET_CATEGORIES_MAX,
  ASSET_VERSION_STATUSES,
  ASSET_VERSIONS_MAX,
  isDocumentAssetKind,
  isGeometryAssetKind,
  isSceneAssetKind,
} from './model/types';
export {
  ASSET_CAD_EXTENSIONS,
  ASSET_DRAWING_EXTENSIONS,
  ASSET_ENVIRONMENT_EXTENSIONS,
  ASSET_ID_PATTERN,
  ASSET_LIBRARY_DOCUMENT_PATH,
  ASSET_LIBRARY_STATS_PATH,
  ASSET_MODEL_EXTENSIONS,
  ASSET_UPLOAD_EXTENSIONS,
  getAssetThumbnailPath,
  getFileExtension,
  isRemovableLegacyAssetPath,
  sanitizeAssetFileName,
} from './model/asset-library-paths';
export type { CodeUsedAsset } from './model/code-used-assets';
export { CODE_USED_DRAWINGS } from './model/code-used-assets';
export {
  assertReadableAssetLibraryDocument,
  collectUnreadableAssetRecords,
  createEmptyAssetLibraryDocument,
  sanitizeAssetLibraryDocument,
  sanitizeAssetPlacement,
  sanitizeAssetStats,
  sanitizeAssetStatsTable,
  sanitizeAssetCategories,
} from './lib/sanitize-asset-library';
export type {
  AddAssetVersionInput,
  AssetChangeContext,
  AssetMetadataPatch,
  AssetStatsDelta,
  CreateAssetInput,
} from './lib/asset-versions';
export {
  addAssetVersion,
  canRemoveAssetVersion,
  canTransitionStatus,
  createAssetRecord,
  diffAssetStats,
  getAllowedStatusTransitions,
  getAssetVersion,
  getCurrentAssetVersion,
  getNextAssetVersionNumber,
  removeAssetVersion,
  setAssetThumbnail,
  setAssetVersionStats,
  setCurrentAssetVersion,
  transitionAssetVersionStatus,
  updateAssetMetadata,
  updateAssetVersionNote,
} from './lib/asset-versions';
export type {
  AssetAttentionContext,
  AssetAttentionKind,
} from './lib/asset-attention';
export {
  ASSET_ATTENTION_KINDS,
  countAssetAttention,
  getAssetAttention,
} from './lib/asset-attention';
export type {
  AssetFacets,
  AssetQuery,
  AssetQueryContext,
  AssetSortKey,
} from './lib/asset-library-query';
export {
  ASSET_SORT_KEYS,
  countAssetFacets,
  DEFAULT_ASSET_QUERY,
  findAssetsByContentHash,
  queryAssets,
  resolveVersionSizeBytes,
  resolveVersionStats,
} from './lib/asset-library-query';
export type {
  AssetScope,
  AssetTree,
  AssetTreeKindNode,
  AssetTreeSelection,
  AssetTreeCategoryNode,
} from './lib/asset-tree';
export {
  buildAssetCategoryNodes,
  buildAssetTree,
  countAssetScope,
  getAssetScope,
  hasAllAssetCategories,
  listAssetKindCategories,
  toggleAssetScopeCategory,
  withAssetScope,
} from './lib/asset-tree';
export type {
  AssetPreviewMode,
  ExrHeaderError,
  GlbHeaderError,
} from './lib/asset-file';
export {
  ASSET_ENVIRONMENT_MAX_SIZE,
  createAssetId,
  getAllowedAssetKinds,
  getAssetPreviewMode,
  humanizeAssetFileName,
  readExrSize,
  validateExrHeader,
  validateGlbHeader,
} from './lib/asset-file';
export type { AssetBudgetMetric, AssetBudgetWarning } from './lib/asset-format';
export {
  ASSET_BUDGET,
  evaluateAssetBudget,
  formatBytes,
  formatCount,
  formatDimensions,
  formatMeters,
  formatSignedCount,
  pickGridStep,
} from './lib/asset-format';
export type {
  AssetUsage,
  AssetUsageBlock,
  AssetUsageIndex,
  AssetUsageRef,
  AssetUsageSource,
  AssetUsageState,
  AssetVersionUsage,
} from './lib/asset-usage';
export {
  buildAssetUsageIndex,
  countAssetPlacements,
  getAssetRemoveBlock,
  getAssetUsage,
  getAssetVersionUsage,
  getAssetWithdrawBlock,
  isAssetInUse,
  isAssetVersionInUse,
} from './lib/asset-usage';
export { hashBytes } from './lib/content-hash';
export type { AssetBlobStore } from './lib/asset-blob-store';
export { createMemoryBlobStore } from './lib/asset-blob-store';
export type {
  AssetLibraryRepository,
  AssetOptimizeKind,
  AssetStoredFile,
} from './lib/asset-library-storage';
export {
  ASSET_LIBRARY_STORAGE_KEY,
  AssetLibraryConflictError,
  createBrowserAssetLibraryRepository,
  createDevAssetLibraryRepository,
  getAssetLibraryRepository,
} from './lib/asset-library-storage';
