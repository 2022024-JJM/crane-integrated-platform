import type { RuntimeAlarmDictionaryItem } from './types';

const runtimeAlarmDictionaryCache = new Map<
  number,
  RuntimeAlarmDictionaryItem
>();

export function setRuntimeAlarmDictionary(items: RuntimeAlarmDictionaryItem[]) {
  runtimeAlarmDictionaryCache.clear();

  items.forEach((item) => {
    runtimeAlarmDictionaryCache.set(item.alarmNo, item);
  });
}

export function getRuntimeAlarmMetadata(alarmNo: number) {
  return runtimeAlarmDictionaryCache.get(alarmNo);
}

export function hasRuntimeAlarmDictionary() {
  return runtimeAlarmDictionaryCache.size > 0;
}
