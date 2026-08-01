import type { CraneAsset } from '@crane/domain/asset';

/** 자산 중요도 파생 — 300t 이상은 High (라벨은 mro2:assets.{high|moderate}) */
export function assetCriticality(asset: CraneAsset): 'high' | 'moderate' {
  return asset.capacityTon >= 300 ? 'high' : 'moderate';
}
