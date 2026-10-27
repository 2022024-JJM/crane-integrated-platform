import { describe, expect, it } from 'vitest';
import type { Activity, Note } from '@crane/domain/shared';
import {
  buildTimeline,
  newAssignments,
  sumCounts,
  unreadByRef,
} from '../timeline';

const act = (
  id: string,
  at: string,
  type: Activity['type'] = 'assigned',
  detail?: string,
): Activity => ({
  id,
  kind: 'repair',
  refId: 'r1',
  type,
  by: 'office',
  at,
  detail,
});
const note = (
  id: string,
  at: string,
  side: Note['side'] = 'office',
  refId = 'r1',
): Note => ({ id, kind: 'repair', refId, side, by: 'x', text: id, at });

describe('buildTimeline', () => {
  it('시각순, 같은 시각이면 활동이 먼저', () => {
    const rows = buildTimeline(
      [act('a2', '2026-01-02T00:00:00Z'), act('a1', '2026-01-01T00:00:00Z')],
      [note('n1', '2026-01-02T00:00:00Z')],
    );
    expect(rows.map((r) => r.id)).toEqual(['a1', 'a2', 'n1']);
  });
  it('빈 입력', () => {
    expect(buildTimeline([], [])).toEqual([]);
  });
});

describe('unreadByRef', () => {
  it('상대편 메모만, 본 시각 이후만 센다', () => {
    const notes = [
      note('n1', '2026-01-01T00:00:00Z', 'office'),
      note('n2', '2026-01-03T00:00:00Z', 'office'),
      note('n3', '2026-01-04T00:00:00Z', 'field'),
      note('n4', '2026-01-04T00:00:00Z', 'office', 'r2'),
    ];
    expect(unreadByRef(notes, 'field', {})).toEqual({
      'repair:r1': 2,
      'repair:r2': 1,
    });
    expect(
      unreadByRef(notes, 'field', { 'repair:r1': '2026-01-03T00:00:00Z' }),
    ).toEqual({ 'repair:r2': 1 });
    expect(unreadByRef(notes, 'office', {})).toEqual({ 'repair:r1': 1 });
    expect(sumCounts(unreadByRef(notes, 'field', {}))).toBe(3);
  });
});

describe('newAssignments', () => {
  it('담당이 나인 배정·접수만, since 이후만', () => {
    const acts = [
      act('a1', '2026-01-01T00:00:00Z', 'assigned', '조범희'),
      act('a2', '2026-01-02T00:00:00Z', 'triaged', '조범희'),
      act('a3', '2026-01-03T00:00:00Z', 'assigned', '박순영'),
      act('a4', '2026-01-03T00:00:00Z', 'started', '조범희'),
    ];
    expect(newAssignments(acts, '조범희', undefined).map((a) => a.id)).toEqual([
      'a1',
      'a2',
    ]);
    expect(
      newAssignments(acts, '조범희', '2026-01-01T00:00:00Z').map((a) => a.id),
    ).toEqual(['a2']);
    expect(newAssignments(acts, '', undefined)).toEqual([]);
  });
});
