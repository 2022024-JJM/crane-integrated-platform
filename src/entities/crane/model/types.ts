export type CraneStatus =
  | 'operating'
  | 'idle'
  | 'maintenance'
  | 'warning'
  | 'stopped';

export interface CraneOperationalData {
  id: string;
  name: string;
  regionId: string;
  status: CraneStatus;
  load: number;
  maxLoad: number;
  windSpeed: number;
  boomAngle: number;
  hoistHeight: number;
  slewAngle: number;
  trolleyPosition: number;
  lastUpdated: string;
}
