import { useMemo } from 'react';
import { useRegionRealtimeAlarms } from '@crane/features/alarm';
import type { Site } from '@crane/domain/region';

export interface SiteRealtimeStats {
  critical: number;
  warning: number; // high + medium
  cranes: number;
  regions: number;
}

/**
 * Site에 속한 모든 region의 실시간 알람 통계를 합산한다.
 * Hover summary용 KPI에 사용. region 배열은 빌드 타임 고정이므로 map 훅 호출 안정성 보장.
 */
export function useSiteRealtimeStats(site: Site): SiteRealtimeStats {
  const perRegion = site.regions.map((region) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { stats } = useRegionRealtimeAlarms(region.id);
    return { stats, region };
  });

  return useMemo(() => {
    let critical = 0;
    let warning = 0;
    let cranes = 0;
    for (const { stats, region } of perRegion) {
      critical += stats.critical;
      warning += stats.high + stats.medium;
      cranes +=
        region.statusSummary.normal +
        region.statusSummary.warning +
        region.statusSummary.critical;
    }
    return { critical, warning, cranes, regions: site.regions.length };
  }, [perRegion, site.regions.length]);
}
