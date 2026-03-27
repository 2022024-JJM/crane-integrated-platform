import { restClient } from '@/shared/api';
import type { RuntimeAlarmDictionaryItem } from '../model/types';

export function getRuntimeAlarmDictionary() {
  return restClient.get<RuntimeAlarmDictionaryItem[]>('alarms/runtime');
}
