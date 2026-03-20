import { getRegionTitleKey } from '@/entities/region';
import type { WeatherLocationTarget } from './types';

const REGION_WEATHER_TARGETS: Record<
  string,
  Omit<WeatherLocationTarget, 'source'>
> = {
  // Temporary coordinates until exact monitoring-zone positions are confirmed.
  'dock-1': {
    latitude: 34.8927,
    longitude: 128.6968,
    labelKey: getRegionTitleKey('dock-1'),
  },
  'dock-2': {
    latitude: 34.8952,
    longitude: 128.6884,
    labelKey: getRegionTitleKey('dock-2'),
  },
  'dock-in': {
    latitude: 34.8938,
    longitude: 128.6925,
    labelKey: getRegionTitleKey('dock-in'),
  },
};

export function getRegionWeatherTarget(
  regionId: string,
): WeatherLocationTarget | null {
  const target = REGION_WEATHER_TARGETS[regionId];

  if (!target) {
    return null;
  }

  return {
    ...target,
    source: 'region',
  };
}
