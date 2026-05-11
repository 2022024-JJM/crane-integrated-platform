import { regions } from './mock-data';
import type { Site } from './site-types';

const SITE_DEFINITIONS: ReadonlyArray<Omit<Site, 'regions'>> = [
  {
    id: 'hanwha-ocean',
    displayNameKey: 'common:siteType.hanwha-ocean',
    countryKey: 'common:sites.hanwha-ocean.country',
    center: { lat: 34.873071, lng: 128.710288 },
    defaultRegionZoom: 14,
  },
  {
    id: 'philly-shipyard',
    displayNameKey: 'common:siteType.philly-shipyard',
    countryKey: 'common:sites.philly-shipyard.country',
    // TODO(philly-center): 운영 좌표 확정 후 교체.
    center: { lat: 39.8895, lng: -75.1827 },
    defaultRegionZoom: 14,
  },
];

export const sites: Site[] = SITE_DEFINITIONS.map((definition) => ({
  ...definition,
  regions: regions.filter((region) => region.siteType === definition.id),
}));

export function getSites(): Site[] {
  return sites;
}

export function getSiteById(siteId: Site['id']): Site | undefined {
  return sites.find((site) => site.id === siteId);
}
