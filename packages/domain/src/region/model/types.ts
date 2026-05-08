import type { StatusLevel } from '@crane/core/types/status';
import type { SiteType } from '@crane/core/lib/site-type-context';

export type { StatusLevel } from '@crane/core/types/status';

export interface StatusSummary {
  normal: number;
  warning: number;
  critical: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Region {
  id: string;
  siteType: SiteType;
  status: StatusLevel;
  statusSummary: StatusSummary;
  navigateTo: string;
  center?: LatLng;
}
