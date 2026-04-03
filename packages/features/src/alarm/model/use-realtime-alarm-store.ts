import { create } from 'zustand';

import { getCraneById } from '@crane/domain/crane';
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
  setRuntimeDictionary: (items: RuntimeAlarmDictionaryItem[]) => void;
}

function createActiveAlarmKey(craneId: string, alarmNo: number) {
  return `${craneId}:${alarmNo}`;
}

function getMostRecentActiveAlarmForCrane(
  activeAlarms: Record<string, Alarm>,
  craneId: string,
) {
  return Object.entries(activeAlarms)
    .map(([key, alarm]) => ({ key, alarm }))
    .filter((entry) => entry.alarm.craneId === craneId)
    .sort((left, right) => right.alarm.timestamp.localeCompare(left.alarm.timestamp))[0];
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
  const alarms = Object.values(activeAlarms).filter(
    (alarm) => alarm.regionId === regionId,
  );

  return {
    critical: alarms.filter((alarm) => alarm.severity === 'critical').length,
    high: alarms.filter((alarm) => alarm.severity === 'high').length,
    medium: alarms.filter((alarm) => alarm.severity === 'medium').length,
    info: alarms.filter((alarm) => alarm.severity === 'info').length,
  };
}

export function getRealtimeAlarmHistoryByRegion(history: Alarm[], regionId: string) {
  return history.filter((alarm) => alarm.regionId === regionId);
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
        const historyWithClear = state.history.some((h) => h.id === clearAlarm.id)
          ? state.history
          : [clearAlarm, ...state.history].slice(0, MAX_HISTORY_ITEMS);

        return {
          activeAlarms: nextActiveAlarms,
          history: historyWithClear,
        };
      }

      nextAlarm = mapRealtimeAlarmMessageToAlarm(message);
      nextActiveAlarms[createActiveAlarmKey(message.craneId, message.value)] =
        nextAlarm;

      const activeAlarm = nextAlarm;
      const historyWithActive = state.history.some((h) => h.id === activeAlarm.id)
        ? state.history
        : [activeAlarm, ...state.history].slice(0, MAX_HISTORY_ITEMS);

      return {
        activeAlarms: nextActiveAlarms,
        history: historyWithActive,
      };
    });

    return nextAlarm;
  },
  setRuntimeDictionary: (items) => {
    setRuntimeAlarmDictionary(items);
    set({
      runtimeDictionaryLoaded: true,
    });
  },
}));
