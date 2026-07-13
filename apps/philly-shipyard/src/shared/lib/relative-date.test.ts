import { describe, expect, it } from 'vitest';
import {
  daysFromToday,
  formatRelativeDate,
  parseLocalDate,
  parseLocalDateTime,
  toLocalDateString,
} from './relative-date';

describe('parseLocalDate', () => {
  it('날짜전용 문자열을 로컬 자정으로 파싱한다 (UTC 파싱 하루 밀림 회귀)', () => {
    const d = parseLocalDate('2026-07-13');
    // 미 동부(UTC-4)에서 new Date('2026-07-13')이면 7/12 20:00 → getDate()가 12가 된다
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(0);
  });

  it('datetime 문자열은 날짜부만 취한다', () => {
    const d = parseLocalDate('2026-01-01T23:59:00');
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(0);
  });
});

describe('parseLocalDateTime', () => {
  it('시각 포함 문자열을 로컬 기준으로 파싱한다', () => {
    const d = parseLocalDateTime('2026-07-13T08:30:15');
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(30);
    expect(d.getSeconds()).toBe(15);
  });

  it('날짜전용 문자열은 로컬 자정으로 파싱한다', () => {
    const d = parseLocalDateTime('2026-07-13');
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(0);
  });
});

describe('daysFromToday', () => {
  const today = new Date(2026, 6, 13); // 2026-07-13 로컬 자정

  it('미래는 양수, 과거는 음수, 오늘은 0', () => {
    expect(daysFromToday('2026-07-16', today)).toBe(3);
    expect(daysFromToday('2026-07-13', today)).toBe(0);
    expect(daysFromToday('2026-07-10', today)).toBe(-3);
  });

  it('월 경계를 넘어도 정확하다', () => {
    expect(daysFromToday('2026-08-01', today)).toBe(19);
    expect(daysFromToday('2026-06-30', today)).toBe(-13);
  });

  it('DST 전환 구간에서도 반올림으로 하루 오차가 없다', () => {
    // 2026-03-08 02:00 EST→EDT (미 동부 DST 시작)
    const beforeDst = new Date(2026, 2, 7); // 3/7
    expect(daysFromToday('2026-03-09', beforeDst)).toBe(2);
  });
});

describe('formatRelativeDate', () => {
  it('내일 = D-1, 어제 = D+1 (실시계 기준 스모크)', () => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    expect(formatRelativeDate(toLocalDateString(tomorrow))).toEqual({
      label: 'D-1',
      diff: 1,
      overdue: false,
    });
    expect(formatRelativeDate(toLocalDateString(yesterday))).toEqual({
      label: 'D+1',
      diff: -1,
      overdue: true,
    });
    expect(formatRelativeDate(toLocalDateString(now)).label).toBe('D-Day');
  });
});

describe('toLocalDateString', () => {
  it('로컬 연-월-일을 0패딩으로 반환한다', () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toLocalDateString(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('저녁 시각에도 로컬 날짜를 유지한다 (toISOString 하루 밀림 회귀)', () => {
    // 미 동부 21:00 = UTC 익일 01:00 — toISOString().slice(0,10)이면 하루 밀린다
    const evening = new Date(2026, 6, 13, 21, 0, 0);
    expect(toLocalDateString(evening)).toBe('2026-07-13');
  });
});
