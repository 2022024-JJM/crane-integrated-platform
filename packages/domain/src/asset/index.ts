export type {
  AssetStatus,
  AssetSummary,
  ComponentStatus,
  ComponentType,
  CraneAsset,
  CraneComponent,
  CraneType,
  InspectionInterval,
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
  setAssetInspectionInterval,
  getCraneAssetsBySite,
} from './model/mock-data';
