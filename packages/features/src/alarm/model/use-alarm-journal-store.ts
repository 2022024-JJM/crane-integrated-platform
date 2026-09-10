import { create } from 'zustand';
import type { Alarm } from '@crane/domain/alarm';
import {
  ALARM_JOURNAL_STORAGE_KEY,
  appendJournal,
  readJournal,
  sanitizeAlarmJournalEntry,
  type AlarmJournalEntry,
} from '@crane/domain/journal';

/**
 * 알람 journal 의 React 창구 — 실시간 알람 스토어의 history(세션 100건
 * 휘발)를 축약해 localStorage 에 미러링한다. 쓰는 쪽은 AlarmJournalSync
 * 하나, 대시보드는 `entries` 만 구독한다.
 */

/** Alarm → 영속 축약 항목. 표시·집계에 필요한 필드만 남긴다. */
export function toAlarmJournalEntry(alarm: Alarm): AlarmJournalEntry {
  return {
    id: alarm.id,
    regionId: alarm.regionId,
    craneId: alarm.craneId,
    severity: alarm.severity,
    timestamp: alarm.timestamp,
    alarmCode: alarm.alarmCode ?? null,
    alarmName: alarm.alarmName ?? null,
    active: alarm.active,
  };
}

interface AlarmJournalState {
  /** 최신 먼저, JOURNAL_MAX 개까지. */
  entries: AlarmJournalEntry[];
  hydrated: boolean;
  hydrate: () => void;
  append: (newEntries: readonly AlarmJournalEntry[]) => void;
}

export const useAlarmJournalStore = create<AlarmJournalState>()((set, get) => ({
  entries: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({
      entries: readJournal(
        ALARM_JOURNAL_STORAGE_KEY,
        sanitizeAlarmJournalEntry,
      ),
      hydrated: true,
    });
  },

  append: (newEntries) => {
    if (newEntries.length === 0) return;
    set({
      entries: appendJournal(
        ALARM_JOURNAL_STORAGE_KEY,
        get().entries,
        newEntries,
        (entry) => entry.id,
      ),
    });
  },
}));
