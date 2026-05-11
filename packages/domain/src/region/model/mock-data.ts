import type { SiteType } from '@crane/core/lib/site-type-context';
import type { Region } from './types';

export const regions: Region[] = [
  {
    id: 'dock-1',
    siteType: 'hanwha-ocean',
    status: 'normal',
    statusSummary: { normal: 6, warning: 2, critical: 0 },
    navigateTo: '/outdoor-work/dock-1',
    center: { lat: 34.871991, lng: 128.695966 },
  },
  {
    id: 'dock-2',
    siteType: 'hanwha-ocean',
    status: 'warning',
    statusSummary: { normal: 4, warning: 1, critical: 1 },
    navigateTo: '/outdoor-work/dock-2',
    center: { lat: 34.874952, lng: 128.703929 },
  },
  {
    id: 'dock-in',
    siteType: 'hanwha-ocean',
    status: 'critical',
    statusSummary: { normal: 2, warning: 0, critical: 2 },
    navigateTo: '/indoor-work/dock-in',
    center: { lat: 34.865481, lng: 128.70622 },
  },
  {
    id: 'goliath',
    siteType: 'goliath-crane',
    status: 'normal',
    statusSummary: { normal: 1, warning: 0, critical: 0 },
    navigateTo: '/goliath-work/goliath',
  },
  {
    id: 'philly-dock-2',
    siteType: 'philly-shipyard',
    status: 'warning',
    statusSummary: { normal: 3, warning: 1, critical: 0 },
    navigateTo: '/outdoor-work/philly-dock-2',
    // TODO(philly-center): 운영 좌표 확정 후 교체. 임시값: Aker Philadelphia Shipyard 인근.
    center: { lat: 39.8895, lng: -75.1827 },
  },
];

export function getRegionById(regionId: string) {
  return regions.find((region) => region.id === regionId);
}

export function getRegionsBySiteType(siteType: SiteType) {
  return regions.filter((region) => region.siteType === siteType);
}
