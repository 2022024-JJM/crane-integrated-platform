import { create } from 'zustand';

import { getCraneIdsByRegion } from '@crane/domain/crane';
import type { Alarm, AlarmStatistics } from '@crane/domain/alarm';

const MAX_HISTORY_ITEMS = 100;

interface RealtimeAlarmState {
  activeAlarms: Record<string, Alarm>;
  history: Alarm[];
  /**
   * 로컬 알람(화면이 만든 알람 — 3D 영역 침범 등)을 목록에 넣는다. `active` 면
   * 활성 목록 `key` 에 올리고, 아니면 그 `key` 를 지운다. 이력에는 id dedupe 로
   * 앞에 쌓인다(발생·해제 레코드 각각).
   */
  upsertLocalAlarm: (alarm: Alarm, key: string) => void;
}

/**
 * 알람이 region 에 속하는지 — 크레인 레지스트리(getCraneIdsByRegion)에 있는
 * craneId 이거나, 알람 자체의 regionId 가 그 region 이면 통과. 후자는 로컬
 * 알람(craneId 가 레지스트리에 없는 3D 모델)을 위한 것이다.
 */
export function isAlarmInRegion(
  alarm: Alarm,
  regionId: string,
  allowedCraneIds: ReadonlySet<string>,
): boolean {
  return allowedCraneIds.has(alarm.craneId) || alarm.regionId === regionId;
}

export function getRealtimeAlarmStatsByRegion(
  activeAlarms: Record<string, Alarm>,
  regionId: string,
): AlarmStatistics {
  const allowedCraneIds = new Set(getCraneIdsByRegion(regionId));
  const alarms = Object.values(activeAlarms).filter((alarm) =>
    isAlarmInRegion(alarm, regionId, allowedCraneIds),
  );

  return {
    critical: alarms.filter((alarm) => alarm.severity === 'critical').length,
    high: alarms.filter((alarm) => alarm.severity === 'high').length,
    medium: alarms.filter((alarm) => alarm.severity === 'medium').length,
    info: alarms.filter((alarm) => alarm.severity === 'info').length,
  };
}

export function getRealtimeAlarmHistoryByRegion(
  history: Alarm[],
  regionId: string,
) {
  const allowedCraneIds = new Set(getCraneIdsByRegion(regionId));
  return history.filter((alarm) =>
    isAlarmInRegion(alarm, regionId, allowedCraneIds),
  );
}

/**
 * 알람 목록 — 헤더 벨·전체화면 오버레이가 읽는다. 지금 들어오는
 * 것은 로컬 알람(영역 침범)뿐이다. 크레인 스냅샷 서버에는 알람 API 가 없어
 * 서버 알람 수신 경로가 비어 있다 — 서버에 알람 API 가 생기면 그 피드가 같은
 * 목록에 넣는다.
 */
export const useRealtimeAlarmStore = create<RealtimeAlarmState>((set) => ({
  activeAlarms: {},
  history: [],
  upsertLocalAlarm: (alarm, key) => {
    set((state) => {
      const nextActiveAlarms = { ...state.activeAlarms };
      if (alarm.active) nextActiveAlarms[key] = alarm;
      else delete nextActiveAlarms[key];
      const history = state.history.some((h) => h.id === alarm.id)
        ? state.history
        : [alarm, ...state.history].slice(0, MAX_HISTORY_ITEMS);
      return { activeAlarms: nextActiveAlarms, history };
    });
  },
}));
