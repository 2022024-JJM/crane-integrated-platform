import { addCraneAsset } from '@crane/domain/asset';
import type { AssetStatus, CraneAsset, CraneType } from '@crane/domain/asset';
import { useAssetCreateStore } from './use-asset-create-store';

export interface AssetDraft {
  name: string;
  craneType: CraneType;
  manufacturer: string;
  model: string;
  capacityTon: number;
  spanM?: number;
  liftHeightM?: number;
  serialNumber: string;
  manufactureDate: string;
  installationDate: string;
  warrantyStart: string;
  warrantyEnd: string;
  siteId: string;
  siteName: string;
  locationZone: string;
  indoorOutdoor: 'indoor' | 'outdoor';
  status: AssetStatus;
}

export function useCreateAsset() {
  const bumpTick = useAssetCreateStore((s) => s.bumpTick);

  return (draft: AssetDraft): CraneAsset => {
    const id = `crane-new-${Date.now()}`;
    const asset: CraneAsset = {
      id,
      name: draft.name,
      craneType: draft.craneType,
      manufacturer: draft.manufacturer,
      model: draft.model,
      capacityTon: draft.capacityTon,
      spanM: draft.spanM,
      liftHeightM: draft.liftHeightM,
      serialNumber: draft.serialNumber,
      manufactureDate: draft.manufactureDate,
      installationDate: draft.installationDate,
      warrantyStart: draft.warrantyStart,
      warrantyEnd: draft.warrantyEnd,
      siteId: draft.siteId,
      siteName: draft.siteName,
      locationZone: draft.locationZone,
      indoorOutdoor: draft.indoorOutdoor,
      status: draft.status,
      oshaClassification: 'Overhead and Gantry',
    };
    addCraneAsset(asset);
    bumpTick();
    return asset;
  };
}
