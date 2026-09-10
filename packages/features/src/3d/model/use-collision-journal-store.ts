import { create } from 'zustand';
import {
  COLLISION_JOURNAL_STORAGE_KEY,
  appendJournal,
  readJournal,
  sanitizeCollisionJournalEntry,
  type CollisionJournalEntry,
} from '@crane/domain/journal';

/**
 * 충돌 journal 의 React 창구 — localStorage 영속본을 메모리에 미러링한다.
 * 세션 충돌 스토어(useSceneCollisionStore, 최대 10건·clearHistory 로 비움)와
 * 별개의 append-only 이력이며, 쓰는 쪽은 CollisionJournalSync 하나다.
 * 대시보드는 `entries` 만 구독한다.
 */
interface CollisionJournalState {
  /** 최신 먼저, JOURNAL_MAX 개까지. */
  entries: CollisionJournalEntry[];
  hydrated: boolean;
  /** localStorage 1회 로드. 이미 됐으면 no-op. */
  hydrate: () => void;
  append: (newEntries: readonly CollisionJournalEntry[]) => void;
}

export const useCollisionJournalStore = create<CollisionJournalState>()((
  set,
  get,
) => ({
  entries: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({
      entries: readJournal(
        COLLISION_JOURNAL_STORAGE_KEY,
        sanitizeCollisionJournalEntry,
      ),
      hydrated: true,
    });
  },

  append: (newEntries) => {
    if (newEntries.length === 0) return;
    set({
      entries: appendJournal(
        COLLISION_JOURNAL_STORAGE_KEY,
        get().entries,
        newEntries,
        (entry) => entry.key,
      ),
    });
  },
}));
