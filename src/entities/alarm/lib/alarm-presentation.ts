import {
  getRuntimeAlarmMetadata,
} from '../model/runtime-dictionary-cache';
import type { Alarm, AlarmEventType, AlarmSeverity } from '../model/types';

const alarmEventTranslationKey: Record<AlarmEventType, string> = {
  wind_warning_exceeded: 'common:alarms.windWarningExceeded',
  load_warning_reached: 'common:alarms.loadWarningReached',
  maintenance_due: 'common:alarms.maintenanceDue',
  idle_mode_completed: 'common:alarms.idleModeCompleted',
  emergency_stop_triggered: 'common:alarms.emergencyStopTriggered',
  work_area_changed: 'common:alarms.workAreaChanged',
  wind_stop_exceeded: 'common:alarms.windStopExceeded',
  work_resumed: 'common:alarms.workResumed',
  e_stop_on: 'common:alarms.emergencyStopTriggered',
  crane_system_error: 'common:alarms.workAreaChanged',
  unknown_realtime_alarm: 'common:alarms.workAreaChanged',
};

const alarmSeverityLabelMap = {
  ko: {
    critical: '위험',
    high: '높음',
    medium: '중간',
    info: '정보',
  },
  en: {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    info: 'Info',
  },
  la: {
    critical: 'Criticum',
    high: 'Altum',
    medium: 'Medium',
    info: 'Notitia',
  },
} as const;

function getAlarmActionLabel(active: boolean, language: string) {
  if (language.toLowerCase().startsWith('ko')) {
    return active ? '발생' : '해제';
  }

  if (language.toLowerCase().startsWith('la')) {
    return active ? 'Actum' : 'Solutum';
  }

  return active ? 'Activated' : 'Cleared';
}

function getResolvedAlarmName(alarm: Alarm) {
  if (typeof alarm.alarmNo === 'number') {
    const runtimeMetadata = getRuntimeAlarmMetadata(alarm.alarmNo);
    if (runtimeMetadata?.alarmName) {
      return runtimeMetadata.alarmName;
    }
  }

  return alarm.alarmName ?? alarm.rawTagCode ?? alarm.craneName;
}

function getResolvedAlarmDescription(alarm: Alarm) {
  if (typeof alarm.alarmNo === 'number') {
    const runtimeMetadata = getRuntimeAlarmMetadata(alarm.alarmNo);
    if (runtimeMetadata?.description) {
      return runtimeMetadata.description;
    }
  }

  return alarm.alarmDescription ?? null;
}

export function getAlarmMessageTranslation(alarm: Alarm) {
  return {
    key: alarmEventTranslationKey[alarm.eventType],
    values: alarm.eventData,
  };
}

export function getAlarmSeverityLabel(
  severity: AlarmSeverity,
  language: string,
) {
  const locale = language.toLowerCase().startsWith('ko')
    ? 'ko'
    : language.toLowerCase().startsWith('la')
      ? 'la'
      : 'en';

  return alarmSeverityLabelMap[locale][severity];
}

export function formatAlarmHistoryMessage(alarm: Alarm, language: string) {
  const label =
    getResolvedAlarmDescription(alarm) ?? getResolvedAlarmName(alarm);
  return `${label} ${getAlarmActionLabel(alarm.active, language)}`;
}
