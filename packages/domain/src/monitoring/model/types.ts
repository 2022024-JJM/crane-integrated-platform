export type ReplayLiteValue = string | number | null;
export type ReplayLiteValueMap = Record<string, ReplayLiteValue>;

export interface ReplayTagSchemaItem {
  displayName: string;
  category: string;
  dataType: string | null;
  unit: string | null;
  alarm: boolean;
  slot: number | null;
}

export type ReplayTagSchema = Record<string, ReplayTagSchemaItem>;

export interface ReplayLiteCraneSnapshot {
  craneId: string;
  craneNo: string;
  snapshotAt: string | null;
  tagSchema: ReplayTagSchema | null;
  values: ReplayLiteValueMap;
}

export interface ReplayLiteFrame {
  timestamp: string;
  cranes: ReplayLiteCraneSnapshot[];
}

export interface ReplayLiteResponse {
  from: string;
  to: string;
  craneIds: string[];
  frames: ReplayLiteFrame[];
}

export type MonitoringReplaySiteId = 'internal' | 'external';

export interface MonitoringReplaySite {
  siteId: string;
  siteName: string;
  workType: string;
  notes: string | null;
}

export interface PlaybackFrameResponse {
  time: string;
  values: Record<string, unknown>;
}

export interface OperationIntervalResponse {
  onAt: string;
  offAt: string;
}

export interface PlaybackResponse {
  craneId: string;
  tagSchema: Record<string, unknown>;
  baseline: PlaybackFrameResponse | null;
  timeline: OperationIntervalResponse[];
  frames: PlaybackFrameResponse[];
}

export type PlaybackSiteResponse = PlaybackResponse[];

export interface MonitoringReplayLiteQuery {
  regionId: string;
  from: string;
  to: string;
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
