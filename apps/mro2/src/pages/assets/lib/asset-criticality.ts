import type { CraneAsset } from '@crane/domain/asset';

export type AssetCriticality = 'high' | 'moderate' | 'low';

/**
 * 자산 중요도 파생 — 정격 하중 기준 3단계.
 * 300t 이상 High / 100t 이상 Moderate / 그 미만 Low
 * (라벨은 mro2:assets.{high|moderate|low})
 */
export function assetCriticality(asset: CraneAsset): AssetCriticality {
  if (asset.capacityTon >= 300) return 'high';
  if (asset.capacityTon >= 100) return 'moderate';
  return 'low';
}
