export type ReplayLiteValue = string | number | null;
export type ReplayLiteValueMap = Record<string, ReplayLiteValue>;
export type MonitoringLiveValue = string | number | boolean | null;

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

export interface MonitoringTagDefinition {
  tagDefinitionId: number;
  tagCode: string;
  displayName: string;
  dataType: string | null;
  unit: string | null;
}

export interface RealtimeCraneLiteMessage {
  eventType: 'snapshot.delta';
  craneId: string;
  tagCode: string;
  value: MonitoringLiveValue;
  timestamp: string;
  quality: number;
  changed: boolean;
  occurredAt: string;
}

/**
 * crane-integrated-server 가 Redis 에 들고 STOMP `/topic/cranes` 로 내보내는
 * 크레인 한 대의 현재 상태. 태그 값은 숫자 또는 불리언, `quality` 는 0 이
 * 정상. 시각은 모두 ISO 문자열(없으면 null).
 */
export interface CraneSnapshotTag {
  value: number | boolean;
  quality: number;
  timestamp: string | null;
}

export interface CraneSnapshot {
  craneId: string;
  stationId: string | null;
  bay: string | null;
  /** 태그 중 가장 늦은 이벤트 시각. */
  snapshotAt: string | null;
  /** 서버가 Kafka 에서 마지막으로 받은 시각. */
  lastReceivedAt: string | null;
  /** 서버가 일정 시간 수신이 없으면 false 로 내린다. */
  online: boolean;
  tags: Record<string, CraneSnapshotTag>;
}

/** `/topic/cranes` 봉투 — push 주기마다 바뀐 크레인만 담긴다. */
export interface CraneSnapshotBatch {
  type: 'snapshot';
  sentAt: string | null;
  cranes: unknown[];
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
  value: MonitoringLiveValue;
  alarm: boolean;
  stale: boolean;
  changed: boolean;
}
