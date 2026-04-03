import { useEffect } from 'react';

import { getRuntimeAlarmDictionary } from '@crane/domain/alarm';
import { useRealtimeAlarmStore } from '../model/use-realtime-alarm-store';

export function RuntimeAlarmDictionaryPreload() {
  useEffect(() => {
    let cancelled = false;

    getRuntimeAlarmDictionary()
      .then((items) => {
        if (cancelled) {
          return;
        }

        useRealtimeAlarmStore.getState().setRuntimeDictionary(items);
      })
      .catch((error) => {
        console.error('[ALARM DICTIONARY] failed to load', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
