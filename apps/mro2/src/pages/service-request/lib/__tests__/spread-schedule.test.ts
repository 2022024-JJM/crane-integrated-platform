import { describe, expect, it } from 'vitest';
import { spreadSchedule } from '../spread-schedule';

const none = () => 0;
// 2026-10-28 수요일
describe('spreadSchedule', () => {
  it('담당자마다 하루 상한만큼 차례로 깔고 주말을 건너뛴다', () => {
    const items = [
      { kind: 'repair' as const, id: 'a', assignee: '김' },
      { kind: 'repair' as const, id: 'b', assignee: '김' },
      { kind: 'inspection' as const, id: 'c', assignee: '김' },
      { kind: 'repair' as const, id: 'd', assignee: '박' },
    ];
    const r = spreadSchedule(items, '2026-10-30', none, 2);
    expect(r.entries).toEqual([
      { kind: 'repair', id: 'a', date: '2026-10-30' },
      { kind: 'repair', id: 'b', date: '2026-10-30' },
      { kind: 'inspection', id: 'c', date: '2026-11-02' },
      { kind: 'repair', id: 'd', date: '2026-10-30' },
    ]);
    expect(r.skipped).toBe(0);
  });
  it('시작일이 주말이면 월요일부터', () => {
    const r = spreadSchedule(
      [{ kind: 'repair', id: 'a', assignee: '김' }],
      '2026-10-31',
      none,
    );
    expect(r.entries[0]?.date).toBe('2026-11-02');
  });
  it('기존 부하를 더해서 상한을 본다', () => {
    const load = (who: string, date: string) =>
      who === '김' && date === '2026-10-28' ? 2 : 0;
    const r = spreadSchedule(
      [{ kind: 'repair', id: 'a', assignee: '김' }],
      '2026-10-28',
      load,
      2,
    );
    expect(r.entries[0]?.date).toBe('2026-10-29');
  });
  it('담당자 없는 건은 건너뛰고 센다', () => {
    const r = spreadSchedule(
      [
        { kind: 'repair', id: 'a', assignee: '' },
        { kind: 'repair', id: 'b', assignee: '  ' },
        { kind: 'repair', id: 'c', assignee: '김' },
      ],
      '2026-10-28',
      none,
    );
    expect(r.entries.map((e) => e.id)).toEqual(['c']);
    expect(r.skipped).toBe(2);
  });
  it('기간 안에 자리가 없으면 건너뛴다', () => {
    const r = spreadSchedule(
      [{ kind: 'repair', id: 'a', assignee: '김' }],
      '2026-10-28',
      () => 5,
      2,
      3,
    );
    expect(r.entries).toEqual([]);
    expect(r.skipped).toBe(1);
  });
  it('빈 입력', () => {
    expect(spreadSchedule([], '2026-10-28', none)).toEqual({
      entries: [],
      skipped: 0,
    });
  });
});
