import { useEffect } from 'react';
import {
  toAlarmJournalEntry,
  useAlarmJournalStore,
} from '../model/use-alarm-journal-store';
import { useRealtimeAlarmStore } from '../model/use-realtime-alarm-store';

/**
 * 실시간 알람 스토어 → 영속 journal 브릿지. 앱 셸 runtime effects 에
 * RealtimeAlarmSync 옆에 1회 마운트한다. useRealtimeAlarmStore 는 수정 없이
 * 밖에서 구독만 한다 — history 는 id dedupe 로 앞에 쌓이므로 prev 에 없는
 * id 가 새 알람(발생·해제 레코드 모두)이다.
 */
export function AlarmJournalSync() {
  useEffect(() => {
    useAlarmJournalStore.getState().hydrate();
    return useRealtimeAlarmStore.subscribe((state, prev) => {
      if (state.history === prev.history) return;
      const prevIds = new Set(prev.history.map((alarm) => alarm.id));
      const fresh = state.history.filter((alarm) => !prevIds.has(alarm.id));
      if (fresh.length === 0) return;
      useAlarmJournalStore
        .getState()
        .append(fresh.map(toAlarmJournalEntry));
    });
  }, []);
  return null;
}
