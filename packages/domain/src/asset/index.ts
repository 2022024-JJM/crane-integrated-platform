export type {
  AssetStatus,
  AssetSummary,
  ComponentStatus,
  ComponentType,
  CraneAsset,
  CraneComponent,
  CraneType,
} from './model/types';
export {
  usedLifePercent,
  remainingLifePercent,
  lifeSeverity,
} from './lib/component-life';
export type { LifeSeverity } from './lib/component-life';
export {
  addCraneAsset,
  getAllCraneAssets,
  getAssetSummary,
  getComponentsByCraneId,
  getCraneAssetById,
  getCraneAssetsBySite,
} from './model/mock-data';
