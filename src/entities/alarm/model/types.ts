export type AlarmSeverity = 'critical' | 'high' | 'medium' | 'info';
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
  | 'unknown_realtime_alarm';

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
