export type MonitoringRegionStatus = 'normal' | 'warning' | 'error';

export interface MonitoringRegion {
  id: string;
  name: string;
  siteName: string;
  craneCount: number;
  status: MonitoringRegionStatus;
  statusLabel: string;
  screens: string[];
  route: '/indoor-work' | '/outdoor-work';
}
