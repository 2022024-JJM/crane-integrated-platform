import type { AlarmSeverity } from '@crane/core/types/status';

export type { AlarmSeverity } from '@crane/core/types/status';
export type AlarmEventType =
  | 'wind_warning_exceeded'
  | 'load_warning_reached'
  | 'maintenance_due'
  | 'idle_mode_completed'
  | 'emergency_stop_triggered'
  | 'work_area_changed'
  | 'wind_stop_exceeded'
  | 'work_resumed'
  | 'e_stop_on'
  | 'crane_system_error'
  | 'unknown_realtime_alarm'
  /** 3D 모델 영역 침범(로컬 발생 — 서버 알람이 아니라 화면이 만든 알람). */
  | 'zone_intrusion';

export interface Alarm {
  id: string;
  regionId: string;
  craneId: string;
  craneName: string;
  severity: AlarmSeverity;
  eventType: AlarmEventType;
  active: boolean;
  alarmNo?: number;
  alarmCode?: string;
  alarmName?: string;
  alarmDescription?: string | null;
  rawTagCode?: string;
  eventData?: Record<string, string | number>;
  timestamp: string;
}

export interface AlarmStatistics {
  critical: number;
  high: number;
  medium: number;
  info: number;
}

export interface RuntimeAlarmDictionaryItem {
  alarmNo: number;
  alarmName: string;
  description: string | null;
  active: boolean;
}
