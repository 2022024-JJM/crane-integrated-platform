import { restClient } from '@/shared/api';
import { getApiPath } from '@/shared/config/network';
import type { RuntimeAlarmDictionaryItem } from '../model/types';

export function getRuntimeAlarmDictionary() {
  return restClient.get<RuntimeAlarmDictionaryItem[]>(
    getApiPath('alarms/runtime'),
  );
}
