import {
  RealtimeAlarmSync,
  RuntimeAlarmDictionaryPreload,
} from '@crane/features/alarm';

export function AppRuntimeEffects() {
  return (
    <>
      <RuntimeAlarmDictionaryPreload />
      <RealtimeAlarmSync />
    </>
  );
}
