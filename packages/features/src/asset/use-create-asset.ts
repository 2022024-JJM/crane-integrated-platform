import { useCallback } from 'react';
import { addCraneAsset } from '@crane/domain/asset';
import type { AssetStatus, CraneAsset, CraneType } from '@crane/domain/asset';
import { newAssetId } from '@crane/domain/shared';
import { useDomainEventStore } from '../shared/use-domain-event-store';

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
  const publish = useDomainEventStore((s) => s.publish);

  return useCallback(
    (draft: AssetDraft): CraneAsset => {
      const asset: CraneAsset = {
        id: newAssetId(),
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
      publish('asset', asset.id);
      return asset;
    },
    [publish],
  );
}
