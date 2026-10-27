import { useCallback } from 'react';
import {
  addNote,
  getAllNotes,
  getNotes,
  type Note,
  type NoteRefKind,
  type NoteSide,
} from '@crane/domain/shared';
import {
  useDomainEventStore,
  useEntityTick,
} from '../shared/use-domain-event-store';

export function useNotes(kind: NoteRefKind, refId: string): Note[] {
  useEntityTick('notes');
  return getNotes(kind, refId);
}

/** 목록 화면용 — 전체 메모(배지 계산은 호출자가) */
export function useAllNotes(): Note[] {
  useEntityTick('notes');
  return getAllNotes();
}

export function useAddNote() {
  const publish = useDomainEventStore((s) => s.publish);
  return useCallback(
    (input: {
      kind: NoteRefKind;
      refId: string;
      side: NoteSide;
      by: string;
      text: string;
    }) => {
      const note = addNote(input);
      if (note) publish('notes', note.id);
      return note;
    },
    [publish],
  );
}
