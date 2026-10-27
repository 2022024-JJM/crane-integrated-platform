import { registerPersisted, replaceArray } from './persistence';

export type NoteSide = 'office' | 'field';
export type NoteRefKind = 'repair' | 'inspection' | 'parts';

/** 요청 하나에 달리는 메모 — 사무실 ↔ 현장이 주고받는 한 줄. */
export interface Note {
  id: string;
  kind: NoteRefKind;
  refId: string;
  side: NoteSide;
  by: string;
  text: string;
  /** ISO */
  at: string;
}

const allNotes: Note[] = [];
let seq = 0;
registerPersisted(
  'notes',
  () => allNotes,
  (v: Note[]) => {
    replaceArray(allNotes, v);
    seq = v.length;
  },
);

export function getAllNotes(): Note[] {
  return allNotes;
}

export function getNotes(kind: NoteRefKind, refId: string): Note[] {
  return allNotes.filter((n) => n.kind === kind && n.refId === refId);
}

export function addNote(
  input: Omit<Note, 'id' | 'at'> & { at?: string },
): Note | null {
  const text = input.text.trim();
  if (!text) return null;
  seq += 1;
  const note: Note = {
    id: `note-${Date.now().toString(36)}-${seq}`,
    kind: input.kind,
    refId: input.refId,
    side: input.side,
    by: input.by,
    text,
    at: input.at ?? new Date().toISOString(),
  };
  allNotes.push(note);
  return note;
}

/** 상대편이 남긴 메모 중 `since` 이후 것 — 읽지 않음 배지용 */
export function unreadNotes(
  kind: NoteRefKind,
  refId: string,
  mySide: NoteSide,
  since: string | undefined,
): number {
  return allNotes.filter(
    (n) =>
      n.kind === kind &&
      n.refId === refId &&
      n.side !== mySide &&
      (!since || n.at > since),
  ).length;
}

/** 테스트용 */
export function resetNotesForTest(): void {
  allNotes.length = 0;
  seq = 0;
}
