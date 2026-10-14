import { useEffect } from 'react';

import { getRuntimeAlarmDictionary } from '@crane/domain/alarm';
import { useRealtimeAlarmStore } from '../model/use-realtime-alarm-store';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;

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
          console.error(
            `[ALARM DICTIONARY] load failed (attempt ${attempt}/${MAX_RETRIES})`,
            error,
          );

          if (attempt < MAX_RETRIES) {
            retryTimer = setTimeout(() => load(attempt + 1), RETRY_DELAY_MS);
          }
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
