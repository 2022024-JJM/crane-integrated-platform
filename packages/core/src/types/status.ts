export type AlarmSeverity = 'critical' | 'high' | 'medium' | 'info';

export type CraneStatus =
  | 'operating'
  | 'idle'
  | 'maintenance'
  | 'warning'
  | 'stopped';

export type StatusLevel = 'normal' | 'warning' | 'critical';

/**
 * 3D 관제 화면의 장비 운전 상태 — 태그 값 수신 활동에서 파생한다
 * (features/3d lib/model-runtime-status.ts). PLC 상태 태그가 아니라 값의
 * 변화·수신 시각으로 판정하므로 시뮬레이션·실시간·리플레이 모두 같은 규칙.
 * - running: 최근 창 안에 값이 바뀜(움직이는 중)
 * - idle: 수신은 되지만 값이 안 바뀜
 * - offline: 한 번은 받았지만 수신이 끊김
 * - unknown: 맵핑된 태그가 없거나 아직 한 번도 받지 못함
 */
export type EquipmentRuntimeStatus = 'running' | 'idle' | 'offline' | 'unknown';

// ─── CMMS 상태 타입 ──────────────────────────────────────────────
export type OnOff = 'ON' | 'OFF';
export type OkNg = 'OK' | 'NG';
export type RunFaultStatus = 'STOP' | 'RUN' | 'FAULT';
export type OpenClose = '열림' | '닫힘';
