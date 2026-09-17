import { getRuntimeAlarmMetadata } from '../model/runtime-dictionary-cache';
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
  zone_intrusion: 'common:alarms.zoneIntrusion',
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

/**
 * 위험 수준 라벨 — 3D 모니터링 화면의 알람 목록 배지용(2026-09-17). 심각도
 * 라벨(위험/높음/중간/정보)은 이력·통계 표의 분류 이름이고, 관제 화면에서는
 * "지금 얼마나 위험한가" 로 읽히는 경고/위험 계열이 낫다.
 */
const alarmRiskLevelLabelMap = {
  ko: { critical: '위험', high: '경고', medium: '주의', info: '정보' },
  en: { critical: 'Danger', high: 'Warning', medium: 'Caution', info: 'Info' },
  la: {
    critical: 'Periculum',
    high: 'Monitum',
    medium: 'Cautio',
    info: 'Notitia',
  },
} as const;

function resolveLabelLocale(language: string): 'ko' | 'en' | 'la' {
  const lower = language.toLowerCase();
  return lower.startsWith('ko') ? 'ko' : lower.startsWith('la') ? 'la' : 'en';
}

const alarmSeverityVisualMap = {
  critical: {
    iconClassName: 'text-red-600 dark:text-red-400',
    valueClassName: 'text-red-600 dark:text-red-400',
    surfaceClassName: 'border border-red-500/30 bg-red-500/14',
    emphasisClassName: 'text-red-700 dark:text-red-300',
  },
  high: {
    iconClassName: 'text-orange-500 dark:text-orange-400',
    valueClassName: 'text-orange-500 dark:text-orange-400',
    surfaceClassName: 'border border-orange-500/30 bg-orange-500/12',
    emphasisClassName: 'text-orange-700 dark:text-orange-300',
  },
  medium: {
    iconClassName: 'text-yellow-500 dark:text-yellow-300',
    valueClassName: 'text-yellow-600 dark:text-yellow-300',
    surfaceClassName: 'border border-yellow-500/35 bg-yellow-400/14',
    emphasisClassName: 'text-yellow-700 dark:text-yellow-200',
  },
  info: {
    iconClassName: 'text-blue-500 dark:text-blue-400',
    valueClassName: 'text-blue-500 dark:text-blue-400',
    surfaceClassName: 'border border-blue-500/30 bg-blue-500/10',
    emphasisClassName: 'text-blue-700 dark:text-blue-300',
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
  return alarmSeverityLabelMap[resolveLabelLocale(language)][severity];
}

export function getAlarmRiskLevelLabel(
  severity: AlarmSeverity,
  language: string,
) {
  return alarmRiskLevelLabelMap[resolveLabelLocale(language)][severity];
}

export function getAlarmSeverityVisual(severity: AlarmSeverity) {
  return alarmSeverityVisualMap[severity];
}

export function formatAlarmHistoryMessage(alarm: Alarm, language: string) {
  const label =
    getResolvedAlarmDescription(alarm) ?? getResolvedAlarmName(alarm);
  return `${label} ${getAlarmActionLabel(alarm.active, language)}`;
}
