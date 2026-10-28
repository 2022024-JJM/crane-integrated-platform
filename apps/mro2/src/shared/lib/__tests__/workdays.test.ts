import { describe, expect, it } from 'vitest';
import { addDays, isWeekend, nextWorkday } from '../workdays';

describe('workdays', () => {
  it('addDays 는 월 경계를 넘는다', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-10-28', 0)).toBe('2026-10-28');
  });
  it('isWeekend 는 토·일만 참', () => {
    expect(isWeekend('2026-10-31')).toBe(true); // 토
    expect(isWeekend('2026-11-01')).toBe(true); // 일
    expect(isWeekend('2026-11-02')).toBe(false); // 월
  });
  it('nextWorkday 는 평일이면 그대로, 주말이면 월요일', () => {
    expect(nextWorkday('2026-10-28')).toBe('2026-10-28');
    expect(nextWorkday('2026-10-31')).toBe('2026-11-02');
    expect(nextWorkday('2026-11-01')).toBe('2026-11-02');
  });
});
