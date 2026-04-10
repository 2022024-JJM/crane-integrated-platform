export type AlarmSeverity = 'critical' | 'high' | 'medium' | 'info';

export type CraneStatus =
  | 'operating'
  | 'idle'
  | 'maintenance'
  | 'warning'
  | 'stopped';

export type StatusLevel = 'normal' | 'warning' | 'critical';

// ─── CMMS 상태 타입 ──────────────────────────────────────────────
export type OnOff = 'ON' | 'OFF';
export type OkNg = 'OK' | 'NG';
export type RunFaultStatus = 'STOP' | 'RUN' | 'FAULT';
export type OpenClose = '열림' | '닫힘';
