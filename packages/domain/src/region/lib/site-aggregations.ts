import type { StatusLevel } from '@crane/core/types/status';
import type { Site } from '../model/site-types';
import type { StatusSummary } from '../model/types';

const STATUS_PRIORITY: Record<StatusLevel, number> = {
  normal: 0,
  warning: 1,
  critical: 2,
};

export function getSiteStatus(site: Site): StatusLevel {
  let worst: StatusLevel = 'normal';
  for (const region of site.regions) {
    if (STATUS_PRIORITY[region.status] > STATUS_PRIORITY[worst]) {
      worst = region.status;
    }
  }
  return worst;
}

export function getSiteStatusSummary(site: Site): StatusSummary {
  return site.regions.reduce<StatusSummary>(
    (acc, region) => ({
      normal: acc.normal + region.statusSummary.normal,
      warning: acc.warning + region.statusSummary.warning,
      critical: acc.critical + region.statusSummary.critical,
    }),
    { normal: 0, warning: 0, critical: 0 },
  );
}

export function getSiteCraneCount(site: Site): number {
  const summary = getSiteStatusSummary(site);
  return summary.normal + summary.warning + summary.critical;
}
