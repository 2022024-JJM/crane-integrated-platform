import { describe, expect, it } from 'vitest';
import {
  FIELD_RECENT_MAX,
  FIELD_WORKER_MAX,
  normalizeWorkerName,
  pushRecent,
} from '../field-storage';

describe('pushRecent', () => {
  it('앞에 넣고 중복 제거, 상한으로 자르고, 빈 id 는 복사만', () => {
    expect(pushRecent(['a', 'b'], 'b')).toEqual(['b', 'a']);
    expect(pushRecent(['a'], 'c')).toEqual(['c', 'a']);
    const full = Array.from({ length: FIELD_RECENT_MAX }, (_, i) => `x${i}`);
    expect(pushRecent(full, 'new')).toHaveLength(FIELD_RECENT_MAX);
    expect(pushRecent(full, 'new')[0]).toBe('new');
    const src = ['a'];
    const copy = pushRecent(src, '');
    expect(copy).toEqual(['a']);
    expect(copy).not.toBe(src);
  });
});

describe('normalizeWorkerName', () => {
  it('앞뒤 공백·연속 공백 정리, 상한 자르기', () => {
    expect(normalizeWorkerName('  김  철수 ')).toBe('김 철수');
    expect(normalizeWorkerName('a'.repeat(FIELD_WORKER_MAX + 5))).toHaveLength(
      FIELD_WORKER_MAX,
    );
    expect(normalizeWorkerName('   ')).toBe('');
  });
});
