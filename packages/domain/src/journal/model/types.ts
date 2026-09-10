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

export interface JournalEnvelope<T> {
  version: 1;
  /** 최신 먼저, JOURNAL_MAX 개까지. */
  entries: T[];
}
