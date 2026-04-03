import { restClient } from '@crane/core/api';
import { getApiPath } from '@crane/core/config/network';
import type { RuntimeAlarmDictionaryItem } from '../model/types';

export function getRuntimeAlarmDictionary() {
  return restClient.get<RuntimeAlarmDictionaryItem[]>(
    getApiPath('alarms/runtime'),
  );
}
