import { useEffect } from 'react';

import { getRuntimeAlarmDictionary } from '@crane/domain/alarm';
import { retryDelayMs } from '../lib/alarm-dictionary-retry';
import { useRealtimeAlarmStore } from '../model/use-realtime-alarm-store';

export function RuntimeAlarmDictionaryPreload() {
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function load(attempt: number) {
      getRuntimeAlarmDictionary()
        .then((items) => {
          if (cancelled) return;
          useRealtimeAlarmStore.getState().setRuntimeDictionary(items);
        })
        .catch((error) => {
          if (cancelled) return;
          const delay = retryDelayMs(attempt);
          console.error(
            `[ALARM DICTIONARY] load failed (attempt ${attempt}, retry in ${delay}ms)`,
            error,
          );
          retryTimer = setTimeout(() => load(attempt + 1), delay);
        });
    }

    load(1);

    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
      }
    };
  }, []);

  return null;
}
