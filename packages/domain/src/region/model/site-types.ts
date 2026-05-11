import type { SiteType } from '@crane/core/lib/site-type-context';
import type { LatLng, Region } from './types';

export interface Site {
  id: SiteType;
  displayNameKey: string;
  countryKey: string;
  center: LatLng;
  defaultRegionZoom: number;
  regions: Region[];
}
