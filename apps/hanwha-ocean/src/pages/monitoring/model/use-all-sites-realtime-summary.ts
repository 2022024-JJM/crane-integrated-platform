import { useMemo } from 'react';
import { useRegionRealtimeAlarms } from '@crane/features/alarm';
import { getSites } from '@crane/domain/region';

/**
 * 모든 site의 모든 region 실시간 알람 통계를 합산한다.
 * - warning = high + medium
 * - critical = critical
 * region 배열은 빌드 타임 고정이므로 map으로 훅을 호출해도 순서 안정성이 보장된다.
 */
export function useAllSitesRealtimeSummary() {
  const sites = useMemo(() => getSites(), []);
  const regionIds = useMemo(
    () => sites.flatMap((site) => site.regions.map((region) => region.id)),
    [sites],
  );

  const regionStats = regionIds.map((regionId) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { stats } = useRegionRealtimeAlarms(regionId);
    return stats;
  });

  return useMemo(() => {
    let warning = 0;
    let critical = 0;
    for (const stats of regionStats) {
      critical += stats.critical;
      warning += stats.high + stats.medium;
    }
    return {
      sitesCount: sites.length,
      warning,
      critical,
    };
  }, [regionStats, sites.length]);
}
