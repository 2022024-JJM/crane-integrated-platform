import { create } from 'zustand';
import {
  ZONE_JOURNAL_STORAGE_KEY,
  appendJournal,
  readJournal,
  sanitizeZoneJournalEntry,
  type ZoneJournalEntry,
} from '@crane/domain/journal';

/**
 * 영역 침범 journal 의 React 창구 — 충돌 journal(use-collision-journal-store)
 * 과 같은 구조. 쓰는 쪽은 ZoneJournalSync 하나.
 */
interface ZoneJournalState {
  entries: ZoneJournalEntry[];
  hydrated: boolean;
  hydrate: () => void;
  append: (newEntries: readonly ZoneJournalEntry[]) => void;
}

export const useZoneJournalStore = create<ZoneJournalState>()((set, get) => ({
  entries: [],
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    set({
      entries: readJournal(ZONE_JOURNAL_STORAGE_KEY, sanitizeZoneJournalEntry),
      hydrated: true,
    });
  },
  append: (newEntries) => {
    if (newEntries.length === 0) return;
    set({
      entries: appendJournal(
        ZONE_JOURNAL_STORAGE_KEY,
        get().entries,
        newEntries,
        (entry) => entry.key,
      ),
    });
  },
}));
