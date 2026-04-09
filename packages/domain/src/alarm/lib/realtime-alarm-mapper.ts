import { getCraneById } from '../../shared';
import { getRuntimeAlarmMetadata } from '../model/runtime-dictionary-cache';
import type { Alarm, AlarmSeverity } from '../model/types';

export interface RealtimeAlarmMessage {
  eventType: 'alarm.changed';
  craneId: string;
  tagCode: string;
  severity?: AlarmSeverity;
  value: number;
  timestamp: string;
}

export interface RealtimeAlarmCraneMetadata {
  regionId: string;
  craneName: string;
}

export function getRealtimeAlarmCraneMetadata(craneId: string) {
  const crane = getCraneById(craneId);

  if (!crane) {
    return undefined;
  }

  return {
    regionId: crane.regionId,
    craneName: crane.craneName,
  };
}

export function mapRealtimeAlarmMessageToAlarm(
  message: RealtimeAlarmMessage,
  overrides?: Partial<Alarm>,
): Alarm {
  const craneMetadata = getRealtimeAlarmCraneMetadata(message.craneId);
  const runtimeAlarmMetadata =
    message.value > 0 ? getRuntimeAlarmMetadata(message.value) : undefined;
  const active = overrides?.active ?? message.value > 0;

  return {
    id: `alarm:${message.craneId}:${message.value}:${message.timestamp}`,
    regionId: craneMetadata?.regionId ?? 'unknown',
    craneId: message.craneId,
    craneName: craneMetadata?.craneName ?? message.craneId,
    severity: message.severity ?? overrides?.severity ?? 'info',
    eventType: overrides?.eventType ?? 'unknown_realtime_alarm',
    active,
    alarmNo:
      overrides?.alarmNo ?? (message.value > 0 ? message.value : undefined),
    alarmCode: overrides?.alarmCode ?? message.tagCode,
    alarmName:
      overrides?.alarmName ??
      runtimeAlarmMetadata?.alarmName ??
      (message.value > 0 ? `Alarm ${message.value}` : 'Alarm Clear'),
    alarmDescription:
      overrides?.alarmDescription ?? runtimeAlarmMetadata?.description ?? null,
    rawTagCode: overrides?.rawTagCode ?? message.tagCode,
    eventData: overrides?.eventData ?? {
      tagCode: message.tagCode,
      alarmNo: message.value,
    },
    timestamp: message.timestamp,
  };
}
