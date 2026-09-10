import {
  AlarmJournalSync,
  RealtimeAlarmSync,
  RuntimeAlarmDictionaryPreload,
} from '@crane/features/alarm';
import { CollisionJournalSync } from '@crane/features/3d';

export function AppRuntimeEffects() {
  return (
    <>
      <RuntimeAlarmDictionaryPreload />
      <RealtimeAlarmSync />
      <AlarmJournalSync />
      <CollisionJournalSync />
    </>
  );
}
