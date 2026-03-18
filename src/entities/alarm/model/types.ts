export type AlarmSeverity = 'critical' | 'warning' | 'info';
export type AlarmEventType =
  | 'wind_warning_exceeded'
  | 'load_warning_reached'
  | 'maintenance_due'
  | 'idle_mode_completed'
  | 'emergency_stop_triggered'
  | 'work_area_changed'
  | 'wind_stop_exceeded'
  | 'work_resumed';

export interface Alarm {
  id: string;
  regionId: string;
  craneId: string;
  craneName: string;
  severity: AlarmSeverity;
  eventType: AlarmEventType;
  eventData?: Record<string, string | number>;
  timestamp: string;
}

export interface AlarmStatistics {
  critical: number;
  warning: number;
  info: number;
}
