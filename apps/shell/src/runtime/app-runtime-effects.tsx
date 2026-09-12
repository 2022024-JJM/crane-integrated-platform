import {
  AlarmJournalSync,
  RealtimeAlarmSync,
  RuntimeAlarmDictionaryPreload,
} from '@crane/features/alarm';
import {
  CollisionJournalSync,
  SceneAlertNotifier,
  ZoneJournalSync,
} from '@crane/features/3d';
import { ZoneAlarmBridge } from './zone-alarm-bridge';

export function AppRuntimeEffects() {
  return (
    <>
      <RuntimeAlarmDictionaryPreload />
      <RealtimeAlarmSync />
      <AlarmJournalSync />
      <CollisionJournalSync />
      {/* 영역 침범 → 저널·알람 스토어·알림 채널. 충돌 → 알림 채널. */}
      <ZoneJournalSync />
      <ZoneAlarmBridge />
      <SceneAlertNotifier />
    </>
  );
}
