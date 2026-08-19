import type { Region } from '../model/types';

// UserRole을 직접 import하지 않고 string literal로 정의 (domain은 features에 의존하지 않음)
type RegionUserRole =
  | 'philly'
  | 'ocean'
  | 'goliath'
  | 'mro'
  | 'mro2'
  | 'hmi'
  | 'hmi2'
  | 'indoorshop'
  | 'keyin';

export function filterRegionsByRole(
  regions: Region[],
  role: RegionUserRole,
): Region[] {
  switch (role) {
    case 'philly':
      return regions.filter((r) => r.siteType === 'philly-shipyard');
    case 'goliath':
      return regions.filter((r) => r.navigateTo.startsWith('/goliath-work'));
    case 'ocean':
      return regions.filter(
        (r) =>
          !r.navigateTo.startsWith('/goliath-work') &&
          r.siteType !== 'philly-shipyard',
      );
    case 'mro':
      return [];
    case 'mro2':
      return [];
    case 'hmi':
      return [];
    case 'hmi2':
      return [];
    case 'indoorshop':
      return [];
    case 'keyin':
      return [];
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
