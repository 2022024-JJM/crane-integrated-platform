import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarEvent } from '@crane/features/calendar';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { cn } from '@crane/core/lib/utils';
import { isSameDay, minutesFromMidnight, startOfDay } from '../model/date-utils';
import { eventAccent } from '../model/colors';
import { formatTime, formatWeekdayShort } from '../model/format';
import { EventChip } from './event-chip';
import { EventPopoverContent } from './event-popover';
import { Popover, PopoverPopup, PopoverTrigger } from '@crane/ui/molecules/popover';

const START_HOUR = 6;
const END_HOUR = 21; // 06:00 ~ 21:00 실용 범위
const ROW_H = 48; // 시간당 px
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

/** 여러 날에 걸치는 이벤트 여부 (시작·종료 캘린더 날짜가 다름) */
function isMultiDay(e: CalendarEvent): boolean {
  return startOfDay(e.start).getTime() !== startOfDay(e.end).getTime();
}

/** 종일 스트립에 놓일 이벤트: 종일(점검) 또는 다일 이벤트 */
function isStripEvent(e: CalendarEvent): boolean {
  return e.allDay || isMultiDay(e);
}

interface PlacedEvent {
  event: CalendarEvent;
  lane: number;
  laneCount: number;
}

/** 하루 안에서 겹치는 timed 이벤트에 레인(열) 인덱스를 배정 */
function placeEvents(events: CalendarEvent[]): PlacedEvent[] {
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime(),
  );
  const laneEnds: number[] = [];
  const placed = sorted.map((event) => {
    let lane = laneEnds.findIndex((end) => end <= event.start.getTime());
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(event.end.getTime());
    } else {
      laneEnds[lane] = event.end.getTime();
    }
    return { event, lane };
  });
  const laneCount = Math.max(1, laneEnds.length);
  return placed.map((p) => ({ ...p, laneCount }));
}

function DayColumn({
  events,
  isToday,
  now,
  language,
}: {
  events: CalendarEvent[];
  isToday: boolean;
  now: Date;
  language: string;
}) {
  // 종일/다일 이벤트는 상단 스트립으로 가고, 단일일 시각 이벤트만 타임그리드에 배치
  const timed = events.filter((e) => !isStripEvent(e));
  const placed = useMemo(() => placeEvents(timed), [timed]);

  const gridStart = START_HOUR * 60;
  const gridEnd = END_HOUR * 60;
  const nowMin = minutesFromMidnight(now);
  const showNow = isToday && nowMin >= gridStart && nowMin <= gridEnd;

  return (
    <div className={cn('relative border-r border-border/40 last:border-r-0', isToday && 'bg-primary/[0.03]')}>
      {/* 시간 배경선 */}
      {HOURS.map((h) => (
        <div key={h} className="border-b border-border/30" style={{ height: ROW_H }} />
      ))}

      {/* 현재 시각 표시선 */}
      {showNow && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-t border-red-500"
          style={{ top: ((nowMin - gridStart) / 60) * ROW_H }}
        >
          <span className="absolute -left-1 -top-1 size-2 rounded-full bg-red-500" />
        </div>
      )}

      {/* timed 이벤트 */}
      {placed.map(({ event, lane, laneCount }) => {
        const startMin = Math.max(gridStart, minutesFromMidnight(event.start));
        const endMin = Math.min(gridEnd, minutesFromMidnight(event.end));
        const top = ((startMin - gridStart) / 60) * ROW_H;
        const height = Math.max(18, ((endMin - startMin) / 60) * ROW_H);
        const widthPct = 100 / laneCount;
        return (
          <div
            key={event.id}
            className="absolute px-0.5"
            style={{
              top,
              height,
              left: `${lane * widthPct}%`,
              width: `${widthPct}%`,
            }}
          >
            <Popover>
              <PopoverTrigger
                className={cn(
                  'flex h-full w-full cursor-pointer flex-col overflow-hidden rounded border-l-4 border-black/20 px-1.5 py-1 text-left text-[11px] leading-tight text-white transition-opacity hover:opacity-90',
                  eventAccent(event),
                )}
              >
                <span className="shrink-0 font-medium tabular-nums opacity-90">
                  {formatTime(event.start, language)}
                </span>
                <span className="truncate font-medium">{event.title}</span>
              </PopoverTrigger>
              <PopoverPopup align="start" className="p-0">
                <EventPopoverContent event={event} />
              </PopoverPopup>
            </Popover>
          </div>
        );
      })}
    </div>
  );
}

/** 주(7일)·일(1일) 공용 타임그리드 */
export function TimeGrid({
  days,
  events,
}: {
  days: Date[];
  events: CalendarEvent[];
}) {
  const { t, i18n } = useTranslation('calendar');
  const language = i18n.language;
  const now = new Date();

  const eventsByDay = useMemo(() => {
    return days.map((day) => {
      const dayMs = startOfDay(day).getTime();
      return events.filter((e) => {
        const s = startOfDay(e.start).getTime();
        const en = startOfDay(e.end).getTime();
        return dayMs >= s && dayMs <= en; // 걸치는 모든 날에 포함
      });
    });
  }, [days, events]);

  const gridCols = { gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` };
  const hasAllDay = eventsByDay.some((list) => list.some(isStripEvent));

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border/80">
      {/* 요일 헤더 */}
      <div className="grid border-b border-border/60 bg-muted/40" style={gridCols}>
        <div className="border-r border-border/40" />
        {days.map((day) => {
          const isToday = isSameDay(day, now);
          return (
            <div
              key={day.toISOString()}
              className="border-r border-border/40 py-2 text-center last:border-r-0"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {formatWeekdayShort(day, language)}
              </div>
              <div
                className={cn(
                  'mx-auto mt-0.5 flex size-6 items-center justify-center rounded-full text-sm tabular-nums',
                  isToday ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground',
                )}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* 종일 이벤트 행 */}
      {hasAllDay && (
        <div className="grid border-b border-border/60 bg-muted/10" style={gridCols}>
          <div className="flex items-center justify-end border-r border-border/40 px-1.5 py-1 text-[10px] text-muted-foreground">
            {t('allDay')}
          </div>
          {eventsByDay.map((list, i) => (
            <div key={i} className="flex flex-col gap-0.5 border-r border-border/40 p-1 last:border-r-0">
              {list.filter(isStripEvent).map((e) => (
                <EventChip key={e.id} event={e} variant="block" />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 시간 그리드 */}
      <ScrollArea className="flex-1">
        <div className="grid" style={gridCols}>
          {/* 시간 눈금 */}
          <div className="border-r border-border/40">
            {HOURS.map((h) => (
              <div
                key={h}
                className="relative border-b border-border/30 text-right"
                style={{ height: ROW_H }}
              >
                <span className="absolute -top-2 right-1.5 text-[10px] tabular-nums text-muted-foreground">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>
          {days.map((day, i) => (
            <DayColumn
              key={day.toISOString()}
              events={eventsByDay[i]}
              isToday={isSameDay(day, now)}
              now={now}
              language={language}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
