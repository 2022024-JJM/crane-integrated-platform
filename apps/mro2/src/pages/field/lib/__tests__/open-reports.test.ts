import { describe, expect, it } from 'vitest';
import type { RepairWO } from '@crane/domain/maintenance';
import { OPEN_REPORTS_LIMIT, openRepairsForAsset } from '../open-reports';

const r = (
  id: string,
  craneId: string,
  status: RepairWO['status'],
  start: string,
): RepairWO => ({ id, craneId, status, scheduledStart: start }) as RepairWO;

describe('openRepairsForAsset', () => {
  it('같은 장비의 미완료만, 최신순, 상한', () => {
    const list = [
      r('a', 'c1', 'received', '2026-01-01'),
      r('b', 'c1', 'completed', '2026-01-09'),
      r('c', 'c2', 'in_progress', '2026-01-05'),
      r('d', 'c1', 'in_progress', '2026-01-03'),
      r('e', 'c1', 'on_hold', '2026-01-02'),
      r('f', 'c1', 'waiting_parts', '2026-01-04'),
    ];
    expect(openRepairsForAsset(list, 'c1').map((x) => x.id)).toEqual([
      'f',
      'd',
      'e',
    ]);
    expect(openRepairsForAsset(list, 'c1').length).toBe(OPEN_REPORTS_LIMIT);
    expect(openRepairsForAsset(list, 'c1', 10).map((x) => x.id)).toEqual([
      'f',
      'd',
      'e',
      'a',
    ]);
  });
  it('장비 없음·없는 장비는 빈 배열', () => {
    expect(
      openRepairsForAsset([r('a', 'c1', 'received', '2026-01-01')], null),
    ).toEqual([]);
    expect(
      openRepairsForAsset([r('a', 'c1', 'received', '2026-01-01')], 'zz'),
    ).toEqual([]);
  });
});
