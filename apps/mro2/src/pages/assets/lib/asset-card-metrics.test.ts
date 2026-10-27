import { describe, expect, it } from 'vitest';
import { inspectionDue } from './asset-card-metrics';

const NOW = new Date(2026, 6, 10, 15, 0, 0).getTime();

describe('inspectionDue', () => {
  it('없음·잘못된 날짜 → none, 과거 → overdue, 오늘 → due 0, 미래 → due N', () => {
    expect(inspectionDue(undefined, NOW)).toEqual({ kind: 'none' });
    expect(inspectionDue('bad', NOW)).toEqual({ kind: 'none' });
    expect(inspectionDue('2026-07-07', NOW)).toEqual({
      kind: 'overdue',
      days: 3,
    });
    expect(inspectionDue('2026-07-10', NOW)).toEqual({ kind: 'due', days: 0 });
    expect(inspectionDue('2026-07-20', NOW)).toEqual({ kind: 'due', days: 10 });
  });
});
