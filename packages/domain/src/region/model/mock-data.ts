import type { SiteType } from '@crane/core/lib/site-type-context';
import type { Region } from './types';

export const regions: Region[] = [
  {
    id: 'dock-1',
    siteType: 'hanwha-ocean',
    status: 'normal',
    statusSummary: { normal: 6, warning: 2, critical: 0 },
    navigateTo: '/outdoor-work/dock-1',
    center: { lat: 34.8806, lng: 128.6878 },
    polygon: [
      { lat: 34.8815, lng: 128.6862 },
      { lat: 34.8815, lng: 128.6894 },
      { lat: 34.8797, lng: 128.6894 },
      { lat: 34.8797, lng: 128.6862 },
    ],
  },
  {
    id: 'dock-2',
    siteType: 'hanwha-ocean',
    status: 'warning',
    statusSummary: { normal: 4, warning: 1, critical: 1 },
    navigateTo: '/outdoor-work/dock-2',
    center: { lat: 34.8836, lng: 128.6912 },
    polygon: [
      { lat: 34.8847, lng: 128.6896 },
      { lat: 34.8847, lng: 128.6928 },
      { lat: 34.8825, lng: 128.6928 },
      { lat: 34.8825, lng: 128.6896 },
    ],
  },
  {
    id: 'dock-in',
    siteType: 'hanwha-ocean',
    status: 'critical',
    statusSummary: { normal: 2, warning: 0, critical: 2 },
    navigateTo: '/indoor-work/dock-in',
    center: { lat: 34.8782, lng: 128.6928 },
    polygon: [
      { lat: 34.8792, lng: 128.6914 },
      { lat: 34.8792, lng: 128.6942 },
      { lat: 34.8772, lng: 128.6942 },
      { lat: 34.8772, lng: 128.6914 },
    ],
  },
  {
    id: 'goliath',
    siteType: 'goliath-crane',
    status: 'normal',
    statusSummary: { normal: 1, warning: 0, critical: 0 },
    navigateTo: '/goliath-work/goliath',
    center: { lat: 34.8821, lng: 128.6885 },
  },
  {
    id: 'philly-dock-2',
    siteType: 'philly-shipyard',
    status: 'warning',
    statusSummary: { normal: 3, warning: 1, critical: 0 },
    navigateTo: '/outdoor-work/philly-dock-2',
  },
];

export function getRegionById(regionId: string) {
  return regions.find((region) => region.id === regionId);
}

export function getRegionsBySiteType(siteType: SiteType) {
  return regions.filter((region) => region.siteType === siteType);
}
