export type ReplayLiteValueMap = Record<string, string | number | null>;

export interface ReplayLiteCraneSnapshot {
  craneId: string;
  craneNo: string;
  snapshotAt: string | null;
  values: ReplayLiteValueMap;
}

export interface ReplayLiteFrame {
  timestamp: string;
  cranes: ReplayLiteCraneSnapshot[];
}

export interface ReplayLiteResponse {
  from: string;
  to: string;
  interval: string;
  craneIds: string[];
  frames: ReplayLiteFrame[];
}

export interface MonitoringReplayLiteQuery {
  from: string;
  to: string;
  interval: string;
}

export interface MonitoringReplayRow {
  id: string;
  frameTimestamp: string;
  snapshotAt: string | null;
  craneId: string;
  craneNo: string;
  tagCode: string;
  displayName: string;
  category: string;
  dataType: string | null;
  unit: string | null;
  direction: string | null;
  value: string | number | null;
  alarm: boolean;
  stale: boolean;
  changed: boolean;
}
