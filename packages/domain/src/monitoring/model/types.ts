export type ReplayLiteValue = string | number | boolean | null;
export type ReplayLiteValueMap = Record<string, ReplayLiteValue>;

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
  craneIds: string[];
  frames: ReplayLiteFrame[];
}

export interface MonitoringReplayLiteQuery {
  regionId: string;
  /** 이력을 받을 크레인 — 씬 모델의 craneId(`collectSceneCraneIds`). */
  craneIds: readonly string[];
  from: string;
  to: string;
}

/**
 * 크레인 스냅샷 서버의 범위 — 내업(indoor)·외업(outdoor). ISL 토픽
 * (`ocean.crane.{scope}.event`)과 같고, REST `/api/{scope}/cranes`·STOMP
 * `/topic/{scope}/cranes` 경로를 가른다. region 의 범위는 `getCraneScopeByRegion`.
 */
export type CraneScope = 'indoor' | 'outdoor';

export const CRANE_SCOPES: readonly CraneScope[] = ['indoor', 'outdoor'];

/**
 * `GET /api/{scope}/cranes/{craneId}/history` 조회 조건. 시각은 ISO-8601(UTC),
 * `step` 은 `5s`·`1m` 꼴(생략 시 서버 기본값).
 */
export interface CraneHistoryQuery {
  scope: CraneScope;
  craneId: string;
  from: string;
  to: string;
  step?: string;
}

/** 이력 프레임 한 장 — 그 시각의 전체 태그 값(sample-and-hold). null 은 값 없음. */
export interface CraneHistoryFrame {
  time: string;
  values: Record<string, number | boolean | null>;
}

/**
 * `GET /api/{scope}/cranes/{craneId}/history` 응답. `frames` 는 `from` 부터 `step`
 * 간격이고 첫 프레임에 `baseline`(from 이전 마지막 행, 없으면 null)이 이미
 * 반영돼 있다. `truncated` 는 행 상한에 걸려 `to` 전에 끝났다는 뜻.
 */
export interface CraneHistoryFrames {
  craneId: string;
  from: string;
  to: string;
  step: string;
  tags: string[];
  baseline: CraneHistoryFrame | null;
  frames: CraneHistoryFrame[];
  truncated: boolean;
}

/**
 * crane-integrated-server 가 Redis 에 들고 STOMP `/topic/{scope}/cranes` 로
 * 내보내는 크레인 한 대의 현재 상태. 태그 값은 숫자·불리언 또는 null(원본이
 * 값 없음 — JSON null·문자열 "NULL"), `quality` 는 0 이 정상. 시각은 모두 ISO
 * 문자열(없으면 null).
 */
export interface CraneSnapshotTag {
  value: number | boolean | null;
  quality: number;
  timestamp: string | null;
}

export interface CraneSnapshot {
  craneId: string;
  /** 서버가 이 크레인을 받은 토픽의 범위. 옛 JSON 에 없으면 indoor. */
  scope: CraneScope;
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

/** `/topic/{scope}/cranes` 봉투 — push 주기마다 바뀐 크레인만 담긴다. */
export interface CraneSnapshotBatch {
  type: 'snapshot';
  sentAt: string | null;
  cranes: unknown[];
}
