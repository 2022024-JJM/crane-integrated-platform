// 캘린더 그리드 계산용 순수 Date 헬퍼 (외부 날짜 라이브러리 없음).
// WO 문자열 파싱은 useServiceCalendar 훅이 담당하므로 여기서는 Date 연산만 다룬다.

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** 일요일(0) 시작 기준 주의 첫날 */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** 월 그리드용 6×7 = 42칸 (해당 월을 포함하는 주 시작~) */
export function buildMonthMatrix(anchor: Date): Date[][] {
  const first = startOfWeek(startOfMonth(anchor));
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const days: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      days.push(addDays(first, w * 7 + i));
    }
    weeks.push(days);
  }
  return weeks;
}

/** 주 그리드용 7일 */
export function buildWeekDays(anchor: Date): Date[] {
  const first = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** 자정 기준 경과 분 (타임그리드 세로 위치 계산) */
export function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
