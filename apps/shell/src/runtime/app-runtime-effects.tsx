import { AlarmJournalSync } from '@crane/features/alarm';
import {
  CollisionJournalSync,
  SceneAlertNotifier,
  ZoneJournalSync,
} from '@crane/features/3d';
import { ZoneAlarmBridge } from './zone-alarm-bridge';

export function AppRuntimeEffects() {
  return (
    <>
      {/* 서버 알람 피드는 없다 — 크레인 스냅샷 서버에 알람 API 가 생기면 여기 붙인다. */}
      <AlarmJournalSync />
      <CollisionJournalSync />
      {/* 영역 침범 → 저널·알람 스토어·알림 채널. 충돌 → 알림 채널. */}
      <ZoneJournalSync />
      <ZoneAlarmBridge />
      <SceneAlertNotifier />
    </>
  );
}
