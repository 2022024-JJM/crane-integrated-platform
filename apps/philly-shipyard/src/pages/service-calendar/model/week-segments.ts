import type { CalendarEvent } from '@crane/features/calendar';
import { startOfDay } from './date-utils';

/**
 * 구글 캘린더식 가로 스패닝 배치 — 월 뷰 주 행과 주 뷰 종일 스트립이 공유한다.
 * 이벤트를 열(일) 범위 세그먼트로 자르고, 걸치는 모든 열이 비어 있는
 * 가장 낮은 세로 슬롯에 배정한다.
 */

export function daysDiff(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export function isMultiDay(e: CalendarEvent): boolean {
  return startOfDay(e.start).getTime() !== startOfDay(e.end).getTime();
}

/** 가로 솔리드 바로 그릴 이벤트: 종일 또는 다일 */
export function isStripEvent(e: CalendarEvent): boolean {
  return e.allDay || isMultiDay(e);
}

export interface SpanSegment {
  event: CalendarEvent;
  /** 기간 내 시작 열 (0부터) */
  startCol: number;
  /** 차지하는 열 수 */
  span: number;
  /** 표시 기간 밖으로 이어지는지 (이어지는 끝은 각지게 렌더) */
  continuesLeft: boolean;
  continuesRight: boolean;
  isStrip: boolean;
  /** 배정된 세로 슬롯 (0부터) */
  slot: number;
}

export function buildSpanSegments(
  days: Date[],
  events: CalendarEvent[],
): { segments: SpanSegment[]; coveringByCol: CalendarEvent[][] } {
  const cols = days.length;
  const rangeStart = days[0];
  const rangeEnd = days[cols - 1];

  const raw = events
    .map((event) => {
      const evStart = startOfDay(event.start);
      const evEnd = startOfDay(event.end);
      if (evEnd.getTime() < rangeStart.getTime() || evStart.getTime() > rangeEnd.getTime()) {
        return null;
      }
      const startCol = Math.max(0, daysDiff(evStart, rangeStart));
      const endCol = Math.min(cols - 1, daysDiff(evEnd, rangeStart));
      return {
        event,
        startCol,
        span: endCol - startCol + 1,
        continuesLeft: evStart.getTime() < rangeStart.getTime(),
        continuesRight: evEnd.getTime() > rangeEnd.getTime(),
        isStrip: isStripEvent(event),
      };
    })
    .filter((s): s is Omit<SpanSegment, 'slot'> => s !== null);

  // 스트립 우선(시작 열 → 긴 스팬 → 시작 시각), 이후 시각 이벤트(시작 시각순)
  raw.sort((a, b) => {
    if (a.isStrip !== b.isStrip) return a.isStrip ? -1 : 1;
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    if (a.span !== b.span) return b.span - a.span;
    return a.event.start.getTime() - b.event.start.getTime();
  });

  // 열별 슬롯 점유표 — 걸치는 모든 열이 비는 가장 낮은 슬롯 배정
  const occupied: boolean[][] = Array.from({ length: cols }, () => []);
  const segments: SpanSegment[] = raw.map((seg) => {
    let slot = 0;
    for (;;) {
      let free = true;
      for (let c = seg.startCol; c < seg.startCol + seg.span; c += 1) {
        if (occupied[c][slot]) {
          free = false;
          break;
        }
      }
      if (free) break;
      slot += 1;
    }
    for (let c = seg.startCol; c < seg.startCol + seg.span; c += 1) {
      occupied[c][slot] = true;
    }
    return { ...seg, slot };
  });

  // 'N개 더보기' 팝오버용 — 각 열을 덮는 전체 이벤트 목록
  const coveringByCol: CalendarEvent[][] = Array.from({ length: cols }, (_, c) =>
    segments
      .filter((s) => c >= s.startCol && c < s.startCol + s.span)
      .map((s) => s.event),
  );

  return { segments, coveringByCol };
}
