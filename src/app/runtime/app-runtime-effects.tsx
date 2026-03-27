import {
  RealtimeAlarmSync,
  RuntimeAlarmDictionaryPreload,
} from '@/features/alarm';

export function AppRuntimeEffects() {
  return (
    <>
      <RuntimeAlarmDictionaryPreload />
      <RealtimeAlarmSync />
    </>
  );
}
