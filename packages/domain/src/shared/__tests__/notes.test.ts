import { beforeEach, describe, expect, it } from 'vitest';
import { addNote, getNotes, resetNotesForTest, unreadNotes } from '../notes';

beforeEach(() => resetNotesForTest());

describe('notes', () => {
  it('빈 글은 무시, 요청별로 모이고 순서 유지', () => {
    expect(
      addNote({
        kind: 'repair',
        refId: 'r1',
        side: 'office',
        by: 'a',
        text: '  ',
      }),
    ).toBeNull();
    addNote({
      kind: 'repair',
      refId: 'r1',
      side: 'office',
      by: 'a',
      text: '사진 부탁',
      at: '2026-01-01T00:00:00Z',
    });
    addNote({
      kind: 'repair',
      refId: 'r1',
      side: 'field',
      by: 'b',
      text: '올렸음',
      at: '2026-01-02T00:00:00Z',
    });
    addNote({
      kind: 'repair',
      refId: 'r2',
      side: 'field',
      by: 'b',
      text: '다른 건',
    });
    expect(getNotes('repair', 'r1').map((n) => n.text)).toEqual([
      '사진 부탁',
      '올렸음',
    ]);
  });
  it('unread 는 상대편 메모 중 since 이후만', () => {
    addNote({
      kind: 'repair',
      refId: 'r1',
      side: 'office',
      by: 'a',
      text: '1',
      at: '2026-01-01T00:00:00Z',
    });
    addNote({
      kind: 'repair',
      refId: 'r1',
      side: 'office',
      by: 'a',
      text: '2',
      at: '2026-01-03T00:00:00Z',
    });
    addNote({
      kind: 'repair',
      refId: 'r1',
      side: 'field',
      by: 'b',
      text: 'x',
      at: '2026-01-04T00:00:00Z',
    });
    expect(unreadNotes('repair', 'r1', 'field', undefined)).toBe(2);
    expect(unreadNotes('repair', 'r1', 'field', '2026-01-02T00:00:00Z')).toBe(
      1,
    );
    expect(unreadNotes('repair', 'r1', 'office', '2026-01-02T00:00:00Z')).toBe(
      1,
    );
  });
});
