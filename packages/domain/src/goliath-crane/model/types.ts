import type { CraneStatus } from '@crane/core/types/status';

export interface GoliathCraneDetail {
  id: string;
  name: string;
  craneNo: string;
  regionId: string;
  status: CraneStatus;
  load: number;
  maxLoad: number;
  auxLoad: number;
  auxMaxLoad: number;
  windSpeed: number;
  windSpeedThreshold: number;
  boomAngle: number;
  hoistHeight: number;
  auxHoistHeight: number;
  slewAngle: number;
  trolleyPosition: number;
  girderLength: number;
  railPositionLeft: number;
  railPositionRight: number;
  railSpan: number;
  operatingHoursToday: number;
  cycleCountToday: number;
  antiCollisionActive: boolean;
  overloadProtectionActive: boolean;
  loadWarningThreshold: number;
  lastUpdated: string;
  // Equipment status
  hoistMotorTemp: number;
  hoistMotorCurrent: number;
  trolleyMotorTemp: number;
  trolleyMotorCurrent: number;
  travelMotorTemp: number;
  travelMotorCurrent: number;
  wireRopeUsageCount: number;
  wireRopeMaxCount: number;
  brakeStatus: 'normal' | 'warning' | 'fault';
}

export interface GoliathSensorTimeSeries {
  timestamp: string;
  load: number;
  windSpeed: number;
  hoistHeight: number;
}

export interface GoliathSafetyParameter {
  id: string;
  nameKey: string;
  currentValue: number;
  threshold: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
}

export interface GoliathOperationLogEntry {
  id: string;
  timestamp: string;
  actionKey: string;
  operator: string;
  details?: string;
}

export type TimeRange = '1h' | '6h' | '12h' | '24h';
