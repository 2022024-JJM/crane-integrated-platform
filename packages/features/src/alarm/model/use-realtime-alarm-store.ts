import { create } from 'zustand';

import { getCraneById, getCraneIdsByRegion } from '@crane/domain/crane';
import type {
  Alarm,
  AlarmStatistics,
  RuntimeAlarmDictionaryItem,
} from '@crane/domain/alarm';
import {
  setRuntimeAlarmDictionary,
  mapRealtimeAlarmMessageToAlarm,
  type RealtimeAlarmMessage,
} from '@crane/domain/alarm';

const MAX_HISTORY_ITEMS = 100;

interface RealtimeAlarmState {
  activeAlarms: Record<string, Alarm>;
  history: Alarm[];
  runtimeDictionaryLoaded: boolean;
  pushMessage: (message: RealtimeAlarmMessage) => Alarm | null;
  /**
   * 로컬 알람(화면이 만든 알람 — 3D 영역 침범 등)을 서버 알람과 같은 목록에
   * 넣는다. `active` 면 활성 목록 `key` 에 올리고, 아니면 그 `key` 를 지운다.
   * 이력에는 id dedupe 로 앞에 쌓인다(발생·해제 레코드 각각).
   */
  upsertLocalAlarm: (alarm: Alarm, key: string) => void;
  setRuntimeDictionary: (items: RuntimeAlarmDictionaryItem[]) => void;
}

/**
 * 알람이 region 에 속하는지 — 크레인 레지스트리(getCraneIdsByRegion)에 있는
 * craneId 이거나, 알람 자체의 regionId 가 그 region 이면 통과. 후자는 로컬
 * 알람(craneId 가 레지스트리에 없는 3D 모델)을 위한 것이고, 서버 알람은
 * regionId 를 같은 레지스트리에서 역조회하므로 동작이 달라지지 않는다.
 */
export function isAlarmInRegion(
  alarm: Alarm,
  regionId: string,
  allowedCraneIds: ReadonlySet<string>,
): boolean {
  return allowedCraneIds.has(alarm.craneId) || alarm.regionId === regionId;
}

function createActiveAlarmKey(
  regionId: string,
  craneId: string,
  alarmNo: number,
) {
  return `${regionId}:${craneId}:${alarmNo}`;
}

function getMostRecentActiveAlarmForCrane(
  activeAlarms: Record<string, Alarm>,
  craneId: string,
) {
  return Object.entries(activeAlarms)
    .map(([key, alarm]) => ({ key, alarm }))
    .filter((entry) => entry.alarm.craneId === craneId)
    .sort((left, right) =>
      right.alarm.timestamp.localeCompare(left.alarm.timestamp),
    )[0];
}

export function isRealtimeAlarmMessage(
  value: unknown,
): value is RealtimeAlarmMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.eventType === 'alarm.changed' &&
    typeof candidate.craneId === 'string' &&
    typeof candidate.tagCode === 'string' &&
    typeof candidate.value === 'number' &&
    (candidate.severity === undefined ||
      candidate.severity === 'critical' ||
      candidate.severity === 'high' ||
      candidate.severity === 'medium' ||
      candidate.severity === 'info') &&
    typeof candidate.timestamp === 'string'
  );
}

export function shouldTrackRealtimeAlarmMessage(message: RealtimeAlarmMessage) {
  return Boolean(getCraneById(message.craneId));
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

export const useRealtimeAlarmStore = create<RealtimeAlarmState>((set) => ({
  activeAlarms: {},
  history: [],
  runtimeDictionaryLoaded: false,
  pushMessage: (message) => {
    let nextAlarm: Alarm | null = null;

    set((state) => {
      const nextActiveAlarms = { ...state.activeAlarms };

      if (message.value === 0) {
        const target = getMostRecentActiveAlarmForCrane(
          state.activeAlarms,
          message.craneId,
        );

        if (!target) {
          return state;
        }

        delete nextActiveAlarms[target.key];
        nextAlarm = mapRealtimeAlarmMessageToAlarm(message, {
          active: false,
          alarmNo: target.alarm.alarmNo,
          alarmCode: target.alarm.alarmCode,
          alarmName: target.alarm.alarmName,
          alarmDescription: target.alarm.alarmDescription,
          severity: target.alarm.severity,
          eventType: target.alarm.eventType,
          rawTagCode: target.alarm.rawTagCode,
          eventData: target.alarm.eventData,
        });

        const clearAlarm = nextAlarm;
        const historyWithClear = state.history.some(
          (h) => h.id === clearAlarm.id,
        )
          ? state.history
          : [clearAlarm, ...state.history].slice(0, MAX_HISTORY_ITEMS);

        return {
          activeAlarms: nextActiveAlarms,
          history: historyWithClear,
        };
      }

      nextAlarm = mapRealtimeAlarmMessageToAlarm(message);
      nextActiveAlarms[
        createActiveAlarmKey(
          nextAlarm.regionId,
          nextAlarm.craneId,
          message.value,
        )
      ] = nextAlarm;

      const activeAlarm = nextAlarm;
      const historyWithActive = state.history.some(
        (h) => h.id === activeAlarm.id,
      )
        ? state.history
        : [activeAlarm, ...state.history].slice(0, MAX_HISTORY_ITEMS);

      return {
        activeAlarms: nextActiveAlarms,
        history: historyWithActive,
      };
    });

    return nextAlarm;
  },
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
  setRuntimeDictionary: (items) => {
    setRuntimeAlarmDictionary(items);
    set({
      runtimeDictionaryLoaded: true,
    });
  },
}));
