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
}
