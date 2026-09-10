// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { JOURNAL_MAX, type CollisionJournalEntry } from '../../model/types';
import { appendJournal, readJournal } from '../journal-storage';
import { sanitizeCollisionJournalEntry } from '../sanitize-journal';

const KEY = 'test:journal';

function entry(at: number, pairKey = 'a|b'): CollisionJournalEntry {
  return {
    key: `${at}:${pairKey}`,
    at,
    pairKey,
    regionId: null,
    a: { modelId: 'a', equipName: 'A' },
    b: { modelId: 'b', equipName: 'B' },
    contactPoint: [0, 0, 0],
  };
}

const getKey = (e: CollisionJournalEntry) => e.key;

beforeEach(() => {
  window.localStorage.clear();
});

describe('readJournal', () => {
  it('저장된 게 없으면 빈 배열', () => {
    expect(readJournal(KEY, sanitizeCollisionJournalEntry)).toEqual([]);
  });

  it('손상 JSON 은 빈 배열로 폴백한다', () => {
    window.localStorage.setItem(KEY, '{not json');
    expect(readJournal(KEY, sanitizeCollisionJournalEntry)).toEqual([]);
  });

  it('봉투가 아니면(구포맷 배열·버전 불일치) 빈 배열', () => {
    window.localStorage.setItem(KEY, JSON.stringify([entry(1)]));
    expect(readJournal(KEY, sanitizeCollisionJournalEntry)).toEqual([]);
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ version: 2, entries: [entry(1)] }),
    );
    expect(readJournal(KEY, sanitizeCollisionJournalEntry)).toEqual([]);
  });

  it('배열 속 불량 항목(null·타입 오염)만 버리고 나머지는 남긴다', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        entries: [entry(2), null, { ...entry(1), at: 'bad' }, entry(1)],
      }),
    );
    const result = readJournal(KEY, sanitizeCollisionJournalEntry);
    expect(result.map((e) => e.at)).toEqual([2, 1]);
  });

  it('cap 초과분은 잘라 읽는다', () => {
    const entries = Array.from({ length: JOURNAL_MAX + 1 }, (_, i) =>
      entry(i),
    );
    window.localStorage.setItem(KEY, JSON.stringify({ version: 1, entries }));
    expect(readJournal(KEY, sanitizeCollisionJournalEntry)).toHaveLength(
      JOURNAL_MAX,
    );
  });
});

describe('appendJournal', () => {
  it('새 항목을 앞에 붙이고 localStorage 에 봉투로 저장한다', () => {
    const merged = appendJournal(KEY, [entry(1)], [entry(2)], getKey);
    expect(merged.map((e) => e.at)).toEqual([2, 1]);
    expect(readJournal(KEY, sanitizeCollisionJournalEntry)).toEqual(merged);
  });

  it('빈 새 항목은 no-op — 같은 참조를 돌려주고 저장하지 않는다', () => {
    const current = [entry(1)];
    expect(appendJournal(KEY, current, [], getKey)).toBe(current);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('같은 key 는 새 항목이 이기고 중복이 남지 않는다', () => {
    const original = entry(1);
    const replacement = { ...entry(1), regionId: 'philly-dock-2' };
    const merged = appendJournal(KEY, [original, entry(0)], [replacement], getKey);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toBe(replacement);
  });

  it('cap 정확값 유지, +1 은 오래된 쪽부터 버린다', () => {
    const current = Array.from({ length: JOURNAL_MAX }, (_, i) => entry(i));
    const merged = appendJournal(KEY, current, [entry(JOURNAL_MAX)], getKey);
    expect(merged).toHaveLength(JOURNAL_MAX);
    expect(merged[0].at).toBe(JOURNAL_MAX);
    // 오래된 쪽(current 마지막) 이 빠졌다
    expect(merged.some((e) => e.key === current[JOURNAL_MAX - 1].key)).toBe(
      false,
    );
  });

  it('손상 저장소 위에 append 하면 정상 봉투로 복구된다', () => {
    window.localStorage.setItem(KEY, '{broken');
    const before = readJournal(KEY, sanitizeCollisionJournalEntry);
    expect(before).toEqual([]);
    appendJournal(KEY, before, [entry(5)], getKey);
    expect(
      readJournal(KEY, sanitizeCollisionJournalEntry).map((e) => e.at),
    ).toEqual([5]);
  });
});
