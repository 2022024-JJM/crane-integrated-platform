import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@crane/features/calendar';
import { buildSpanSegments, isStripEvent } from './week-segments';

// 배치 로직이 읽는 필드만 채운 최소 목
function ev(partial: Partial<CalendarEvent> & { start: Date; end: Date }): CalendarEvent {
  return { id: `${partial.start.toISOString()}-${Math.abs(partial.end.getTime())}`, allDay: false, ...partial } as CalendarEvent;
}

// 2026-07-13(월) ~ 07-19(일)
const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 6, 13 + i));

describe('isStripEvent', () => {
  it('종일 또는 다일 이벤트만 스트립이다', () => {
    expect(isStripEvent(ev({ start: new Date(2026, 6, 13), end: new Date(2026, 6, 13), allDay: true }))).toBe(true);
    expect(isStripEvent(ev({ start: new Date(2026, 6, 13, 9), end: new Date(2026, 6, 15, 17) }))).toBe(true);
    expect(isStripEvent(ev({ start: new Date(2026, 6, 13, 9), end: new Date(2026, 6, 13, 11) }))).toBe(false);
  });
});

describe('buildSpanSegments', () => {
  it('기간 내 열 범위와 연속 표시를 계산한다', () => {
    // 7/11(주 이전) ~ 7/15 → 열 0..2, 왼쪽 연속
    const { segments } = buildSpanSegments(week, [
      ev({ start: new Date(2026, 6, 11), end: new Date(2026, 6, 15), allDay: true }),
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ startCol: 0, span: 3, continuesLeft: true, continuesRight: false });
  });

  it('기간을 완전히 벗어난 이벤트는 제외한다', () => {
    const { segments } = buildSpanSegments(week, [
      ev({ start: new Date(2026, 6, 5), end: new Date(2026, 6, 10), allDay: true }),
      ev({ start: new Date(2026, 6, 25), end: new Date(2026, 6, 26), allDay: true }),
    ]);
    expect(segments).toHaveLength(0);
  });

  it('겹치는 스트립은 서로 다른 슬롯에 배치된다', () => {
    const { segments } = buildSpanSegments(week, [
      ev({ start: new Date(2026, 6, 13), end: new Date(2026, 6, 19), allDay: true }), // 주 전체
      ev({ start: new Date(2026, 6, 14), end: new Date(2026, 6, 16), allDay: true }), // 겹침
    ]);
    const slots = segments.map((s) => s.slot).sort();
    expect(slots).toEqual([0, 1]);
  });

  it('겹치지 않는 이벤트는 같은 슬롯을 재사용한다', () => {
    const { segments } = buildSpanSegments(week, [
      ev({ start: new Date(2026, 6, 13), end: new Date(2026, 6, 14), allDay: true }),
      ev({ start: new Date(2026, 6, 16), end: new Date(2026, 6, 17), allDay: true }),
    ]);
    expect(segments.every((s) => s.slot === 0)).toBe(true);
  });

  it('스트립이 시각 이벤트보다 위 슬롯을 차지한다', () => {
    const { segments } = buildSpanSegments(week, [
      ev({ start: new Date(2026, 6, 13, 8), end: new Date(2026, 6, 13, 10) }), // 시각(월)
      ev({ start: new Date(2026, 6, 13), end: new Date(2026, 6, 15), allDay: true }), // 스트립
    ]);
    const strip = segments.find((s) => s.isStrip)!;
    const timed = segments.find((s) => !s.isStrip)!;
    expect(strip.slot).toBe(0);
    expect(timed.slot).toBe(1);
  });

  it('coveringByCol은 각 열을 덮는 이벤트 목록을 준다', () => {
    const { coveringByCol } = buildSpanSegments(week, [
      ev({ start: new Date(2026, 6, 13), end: new Date(2026, 6, 15), allDay: true }), // 월~수
      ev({ start: new Date(2026, 6, 15, 9), end: new Date(2026, 6, 15, 10) }), // 수 시각
    ]);
    expect(coveringByCol[0]).toHaveLength(1); // 월
    expect(coveringByCol[2]).toHaveLength(2); // 수
    expect(coveringByCol[6]).toHaveLength(0); // 일
  });

  it('하루짜리 기간(일 뷰)에서도 동작한다', () => {
    const oneDay = [new Date(2026, 6, 15)];
    const { segments } = buildSpanSegments(oneDay, [
      ev({ start: new Date(2026, 6, 13), end: new Date(2026, 6, 17), allDay: true }),
    ]);
    expect(segments[0]).toMatchObject({
      startCol: 0,
      span: 1,
      continuesLeft: true,
      continuesRight: true,
    });
  });
});
