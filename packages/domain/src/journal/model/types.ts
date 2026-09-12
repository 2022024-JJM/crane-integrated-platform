import type { AlarmSeverity } from '@crane/core/types/status';

/**
 * 관제 이력 journal — 세션 휘발 스토어(충돌 10건·알람 100건)와 별개로
 * localStorage 에 append-only 로 남기는 축약 이력. 대시보드의 일별 추이·
 * 통계가 새로고침을 견디게 하는 것이 목적이다. 원본 스토어는 건드리지 않고
 * 밖에서 구독해 쌓기만 한다.
 */

export const JOURNAL_MAX = 100;
export const COLLISION_JOURNAL_STORAGE_KEY = 'crane:collision-journal';
export const ALARM_JOURNAL_STORAGE_KEY = 'crane:alarm-journal';
export const ZONE_JOURNAL_STORAGE_KEY = 'crane:zone-journal';
export const STATUS_JOURNAL_STORAGE_KEY = 'crane:status-journal';

export interface CollisionJournalParty {
  modelId: string;
  equipName: string;
}

export interface CollisionJournalEntry {
  /**
   * 영속 identity: `${at}:${pairKey}`. 세션 스토어의 `id` 는 새로고침마다
   * 재시작하는 증가 카운터라 쓰지 않는다.
   */
  key: string;
  /** 충돌 시각(Date.now). */
  at: number;
  pairKey: string;
  /** 충돌이 난 씬의 region. 역조회 실패 시 null. */
  regionId: string | null;
  a: CollisionJournalParty;
  b: CollisionJournalParty;
  /** 근사 접촉점(씬 unit). `values` 자세 스냅샷은 캔버스 없인 못 쓰고 커서 제외. */
  contactPoint: readonly [number, number, number];
}

export interface AlarmJournalEntry {
  id: string;
  regionId: string;
  craneId: string;
  severity: AlarmSeverity;
  /** 발생 시각(ISO 문자열 — Alarm.timestamp 그대로). */
  timestamp: string;
  alarmCode: string | null;
  alarmName: string | null;
  active: boolean;
}

/**
 * 영역 침범 이력 — 진입·이탈을 각각 한 항목으로 남긴다(세션 영역 스토어는
 * "현재 침범 중" 상태만 들고 기록이 없다). 이탈 항목은 `durationMs` 로 머문
 * 시간을 담는다.
 */
export interface ZoneJournalEntry {
  /** `${at}:${kind}:${zoneKey}|${intruderId}`. */
  key: string;
  at: number;
  kind: 'enter' | 'exit';
  regionId: string | null;
  zoneKey: string;
  ownerId: string;
  ownerName: string;
  zoneName: string;
  level: 'warn' | 'stop';
  intruderId: string;
  intruderName: string;
  /** 이탈 항목만 — 진입부터 이탈까지(ms). 진입을 못 본 이탈은 null. */
  durationMs: number | null;
}

/**
 * 장비 운전 상태 이력 — 통신두절 진입·복귀만 남긴다(가동↔대기는 수시로 바뀌어
 * 이력으로서 의미가 없고 100건 상한을 금방 채운다).
 */
export interface StatusJournalEntry {
  /** `${at}:${modelId}:${to}`. */
  key: string;
  at: number;
  regionId: string;
  modelId: string;
  equipName: string;
  from: 'running' | 'idle' | 'offline' | 'unknown';
  to: 'running' | 'idle' | 'offline' | 'unknown';
}

export interface JournalEnvelope<T> {
  version: 1;
  /** 최신 먼저, JOURNAL_MAX 개까지. */
  entries: T[];
}
