import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  buildMonthMatrix,
  buildWeekDays,
  endOfMonth,
  isSameDay,
  isSameMonth,
  minutesFromMidnight,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from './date-utils';

describe('startOfWeek', () => {
  it('월요일 시작 기준으로 주의 첫날을 반환한다 (구글 캘린더와 동일)', () => {
    // 2026-07-15는 수요일 → 주 시작은 7/13 월요일
    const wed = new Date(2026, 6, 15);
    const mon = startOfWeek(wed);
    expect(mon.getDate()).toBe(13);
    expect(mon.getDay()).toBe(1);
  });

  it('월요일 자신은 그대로 반환한다', () => {
    const mon = new Date(2026, 6, 13);
    expect(isSameDay(startOfWeek(mon), mon)).toBe(true);
  });

  it('일요일은 같은 주의 월요일(6일 전)로 돌아간다', () => {
    // 2026-07-19는 일요일 → 주 시작은 7/13 월요일
    const sun = new Date(2026, 6, 19);
    expect(startOfWeek(sun).getDate()).toBe(13);
  });

  it('월 경계를 넘는 주도 정확하다', () => {
    // 2026-08-01은 토요일 → 주 시작은 7/27 월요일
    const d = startOfWeek(new Date(2026, 7, 1));
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(27);
  });
});

describe('buildMonthMatrix', () => {
  it('해당 월이 걸치는 실제 주 수(4~6)만 만든다', () => {
    // 2026-07: 수요일 시작, 5주에 걸침
    const july = buildMonthMatrix(new Date(2026, 6, 1));
    expect(july).toHaveLength(5);
    for (const week of july) expect(week).toHaveLength(7);
    // 2026-08: 토요일 시작 31일 — 6주
    expect(buildMonthMatrix(new Date(2026, 7, 1))).toHaveLength(6);
    // 2027-02: 월요일 시작 28일 — 정확히 4주
    expect(buildMonthMatrix(new Date(2027, 1, 1))).toHaveLength(4);
  });

  it('첫 칸은 해당 월 1일을 포함하는 주의 월요일이다', () => {
    // 2026-07-01은 수요일 → 첫 칸은 6/29 월요일
    const weeks = buildMonthMatrix(new Date(2026, 6, 15));
    expect(weeks[0][0].getMonth()).toBe(5);
    expect(weeks[0][0].getDate()).toBe(29);
    expect(weeks[0][0].getDay()).toBe(1);
  });

  it('칸들은 달력 날짜로 연속된다 (DST 전환 주 포함)', () => {
    // 2026-02 매트릭스는 3/8 DST 시작(23시간 하루)을 포함 — ms가 아닌 달력 날짜로 검증
    const weeks = buildMonthMatrix(new Date(2026, 1, 1));
    const flat = weeks.flat();
    for (let i = 1; i < flat.length; i += 1) {
      expect(isSameDay(addDays(flat[i - 1], 1), flat[i])).toBe(true);
    }
  });
});

describe('buildWeekDays', () => {
  it('anchor가 주 중간이어도 월~일 7일을 반환한다', () => {
    const days = buildWeekDays(new Date(2026, 6, 15));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1); // 월
    expect(days[6].getDay()).toBe(0); // 일
  });
});

describe('addMonths / startOfMonth / endOfMonth', () => {
  it('addMonths는 항상 대상 월의 1일을 반환한다', () => {
    const d = addMonths(new Date(2026, 0, 31), 1);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(1);
  });

  it('연 경계를 넘는 이동도 정확하다', () => {
    expect(addMonths(new Date(2026, 11, 15), 1).getFullYear()).toBe(2027);
    expect(addMonths(new Date(2026, 0, 15), -1).getFullYear()).toBe(2025);
  });

  it('endOfMonth는 말일을 반환한다 (윤년 2월 포함)', () => {
    expect(endOfMonth(new Date(2026, 1, 10)).getDate()).toBe(28);
    expect(endOfMonth(new Date(2028, 1, 10)).getDate()).toBe(29); // 2028 윤년
    expect(endOfMonth(new Date(2026, 6, 10)).getDate()).toBe(31);
  });
});

describe('기타 헬퍼', () => {
  it('startOfDay는 시각을 0으로 만든다', () => {
    const d = startOfDay(new Date(2026, 6, 13, 18, 45));
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(13);
  });

  it('addDays는 월 경계를 넘는다', () => {
    expect(addDays(new Date(2026, 6, 31), 1).getMonth()).toBe(7);
  });

  it('isSameMonth는 연도까지 비교한다', () => {
    expect(isSameMonth(new Date(2026, 6, 1), new Date(2027, 6, 1))).toBe(false);
  });

  it('minutesFromMidnight', () => {
    expect(minutesFromMidnight(new Date(2026, 6, 13, 6, 30))).toBe(390);
  });

  it('startOfMonth는 1일 자정', () => {
    const d = startOfMonth(new Date(2026, 6, 13, 12));
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });
});
