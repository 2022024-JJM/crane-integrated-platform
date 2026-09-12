import { create } from 'zustand';
import {
  STATUS_JOURNAL_STORAGE_KEY,
  appendJournal,
  readJournal,
  sanitizeStatusJournalEntry,
  type StatusJournalEntry,
} from '@crane/domain/journal';

/**
 * 운전 상태(통신두절 전환) journal 의 React 창구. 쓰는 쪽은
 * useStatusJournalSync(Monitoring3dView) 하나.
 */
interface StatusJournalState {
  entries: StatusJournalEntry[];
  hydrated: boolean;
  hydrate: () => void;
  append: (newEntries: readonly StatusJournalEntry[]) => void;
}

export const useStatusJournalStore = create<StatusJournalState>()(
  (set, get) => ({
    entries: [],
    hydrated: false,
    hydrate: () => {
      if (get().hydrated) return;
      set({
        entries: readJournal(
          STATUS_JOURNAL_STORAGE_KEY,
          sanitizeStatusJournalEntry,
        ),
        hydrated: true,
      });
    },
    append: (newEntries) => {
      if (newEntries.length === 0) return;
      set({
        entries: appendJournal(
          STATUS_JOURNAL_STORAGE_KEY,
          get().entries,
          newEntries,
          (entry) => entry.key,
        ),
      });
    },
  }),
);
