import type { Alarm, AlarmEventType, AlarmSeverity } from '../model/types';

/**
 * 로컬 알람 — 서버(WebSocket)가 아니라 화면이 스스로 만드는 알람(3D 영역
 * 침범 등). 실시간 알람 스토어의 같은 목록·이력에 들어가 알람 이력 페이지·
 * 헤더 배지·전체화면 알람 패널이 서버 알람과 똑같이 보여 준다.
 *
 * 서버 알람과 다른 점:
 * - `regionId` 를 호출자가 준다(크레인 레지스트리 역조회 없음 — 영역 소유
 *   모델은 craneId 가 없을 수 있다). 지역 필터는 `alarm.regionId === regionId`
 *   로도 통과시킨다(features/alarm `isAlarmInRegion`).
 * - id 는 `local:<eventType>:<subject>:<at>`(+`:clear`) — 서버 id 공간
 *   (`alarm:<craneId>:<no>:<ts>`)과 겹치지 않는다.
 * - 활성 목록 키는 `${regionId}:${craneId}:${eventType}:${subject}` 로,
 *   해제 시 같은 키를 지운다.
 */
export interface LocalAlarmInput {
  eventType: AlarmEventType;
  /** 같은 대상의 발생/해제를 잇는 키(영역이면 `zoneKey|intruderId`). */
  subject: string;
  regionId: string;
  craneId: string;
  craneName: string;
  severity: AlarmSeverity;
  alarmName: string;
  alarmDescription?: string | null;
  active: boolean;
  /** 발생 시각(ms). 해제 레코드는 해제 시각. */
  at: number;
  /** 발생 레코드의 시각 — 해제 레코드가 같은 발생을 가리키게(id 접미 `:clear`). */
  openedAt?: number;
  eventData?: Record<string, string | number>;
}

export function localAlarmActiveKey(input: {
  regionId: string;
  craneId: string;
  eventType: AlarmEventType;
  subject: string;
}): string {
  return `${input.regionId}:${input.craneId}:${input.eventType}:${input.subject}`;
}

export function createLocalAlarm(input: LocalAlarmInput): Alarm {
  const openedAt = input.openedAt ?? input.at;
  const base = `local:${input.eventType}:${input.subject}:${openedAt}`;
  return {
    id: input.active ? base : `${base}:clear`,
    regionId: input.regionId,
    craneId: input.craneId,
    craneName: input.craneName,
    severity: input.severity,
    eventType: input.eventType,
    active: input.active,
    alarmName: input.alarmName,
    alarmDescription: input.alarmDescription ?? null,
    eventData: input.eventData,
    timestamp: new Date(input.at).toISOString(),
  };
}
