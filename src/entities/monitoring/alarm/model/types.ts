export type MonitoringStatTone = 'danger' | 'neutral' | 'ok';

export interface MonitoringStatCard {
  label: string;
  value: string;
  tone: MonitoringStatTone;
}

export type AlarmSeverity = 'Critical' | 'Normal' | 'Warning';

export type AlarmRow = readonly [
  no: string,
  severity: AlarmSeverity,
  occurrenceTime: string,
  target: string,
  count: string,
];
