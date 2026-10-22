import { useMemo } from 'react';
import type { Alarm } from '@crane/domain/alarm';
import { getCraneIdsByRegion } from '@crane/domain/crane';
import {
  isAlarmInRegion,
  useRealtimeAlarmStore,
} from './use-realtime-alarm-store';

/** region 의 활성 알람 — 정렬하지 않는다(소비자가 자기 기준으로 정렬). */
export function selectRegionActiveAlarms(
  activeAlarms: Record<string, Alarm>,
  regionId: string,
): Alarm[] {
  const allowedCraneIds = new Set(getCraneIdsByRegion(regionId));
  const result: Alarm[] = [];
  for (const alarm of Object.values(activeAlarms)) {
    if (isAlarmInRegion(alarm, regionId, allowedCraneIds) && alarm.active) {
      result.push(alarm);
    }
  }
  return result;
}

/**
 * region 의 활성 알람 목록 — 실시간 모니터링 페이지가 관제 HUD 에 넘긴다
 * (features/3d 는 알람 스토어를 모른다 — 같은 레이어라 페이지가 잇는다).
 * 스토어가 바뀔 때만 다시 거른다.
 */
export function useRegionActiveAlarms(regionId: string): Alarm[] {
  const activeAlarms = useRealtimeAlarmStore((s) => s.activeAlarms);
  return useMemo(
    () => selectRegionActiveAlarms(activeAlarms, regionId),
    [activeAlarms, regionId],
  );
}
