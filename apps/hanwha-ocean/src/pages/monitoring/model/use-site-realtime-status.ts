import { useMemo } from 'react';
import type { StatusLevel } from '@crane/core/types/status';
import { useRegionRealtimeAlarms } from '@crane/features/alarm';
import { deriveRegionStatus, type Site } from '@crane/domain/region';

const STATUS_PRIORITY: Record<StatusLevel, number> = {
  normal: 0,
  warning: 1,
  critical: 2,
};

/**
 * Site에 속한 모든 region의 실시간 알람 통계를 worst-of로 합산한 StatusLevel.
 * site.regions 배열은 빌드 타임 고정이므로 훅 호출 순서 안정성이 보장된다.
 */
export function useSiteRealtimeStatus(site: Site): StatusLevel {
  // site.regions가 컴포넌트 lifecycle 동안 고정이라는 전제 하에 map으로 훅 호출.
  const regionStatuses = site.regions.map((region) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { stats } = useRegionRealtimeAlarms(region.id);
    return deriveRegionStatus(stats);
  });

  return useMemo(() => {
    let worst: StatusLevel = 'normal';
    for (const status of regionStatuses) {
      if (STATUS_PRIORITY[status] > STATUS_PRIORITY[worst]) {
        worst = status;
      }
    }
    return worst;
  }, [regionStatuses]);
}
