import type {
  MonitoringReplaySite,
  MonitoringReplaySiteId,
} from '../model/types';

const REGION_REPLAY_SITE_ID_MAP: Record<string, MonitoringReplaySiteId> = {
  'dock-1': 'external',
  'dock-2': 'external',
  'dock-in': 'internal',
  goliath: 'external',
};

export function getMonitoringReplaySiteIdByRegion(regionId: string) {
  const siteId = REGION_REPLAY_SITE_ID_MAP[regionId];

  if (!siteId) {
    throw new Error(`Unsupported monitoring replay region: ${regionId}`);
  }

  return siteId;
}

export function resolveMonitoringReplaySiteId(
  sites: MonitoringReplaySite[],
  regionId: string,
) {
  const expectedSiteId = getMonitoringReplaySiteIdByRegion(regionId);
  const matchedSite = sites.find((site) => site.siteId === expectedSiteId);

  if (!matchedSite) {
    throw new Error(
      `Monitoring replay site "${expectedSiteId}" was not found for region "${regionId}".`,
    );
  }

  return expectedSiteId;
}
