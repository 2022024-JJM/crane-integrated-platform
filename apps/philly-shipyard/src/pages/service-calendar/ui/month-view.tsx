import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarEvent } from '@crane/features/calendar';
import { cn } from '@crane/core/lib/utils';
import {
  addDays,
  buildMonthMatrix,
  isSameDay,
  isSameMonth,
  startOfDay,
} from '../model/date-utils';
import { formatWeekdayShort } from '../model/format';
import { EventChip } from './event-chip';
import { MoreEventsPopover } from './more-events-popover';

const MAX_VISIBLE = 3;

export function MonthView({
  anchor,
  events,
}: {
  anchor: Date;
  events: CalendarEvent[];
}) {
  const { i18n } = useTranslation('calendar');
  const today = new Date();

  const weeks = useMemo(() => buildMonthMatrix(anchor), [anchor]);

  // 날짜별 이벤트 버킷 — 여러 날에 걸치는 이벤트는 걸치는 모든 날짜에 넣는다
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const last = startOfDay(ev.end);
      let day = startOfDay(ev.start);
      let guard = 0;
      while (day.getTime() <= last.getTime() && guard < 366) {
        const key = day.toDateString();
        const list = map.get(key);
        if (list) list.push(ev);
        else map.set(key, [ev]);
        day = addDays(day, 1);
        guard += 1;
      }
    }
    return map;
  }, [events]);

  const weekdayLabels = weeks[0].map((d) => formatWeekdayShort(d, i18n.language));

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border/80">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-border/60 bg-muted/40">
        {weekdayLabels.map((label, i) => (
          <div
            key={i}
            className={cn(
              'py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
              i === 0 && 'text-red-400/80',
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 주 그리드 */}
      <div className="grid flex-1 grid-rows-6">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border/40 last:border-b-0">
            {week.map((day) => {
              const inMonth = isSameMonth(day, anchor);
              const isToday = isSameDay(day, today);
              const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
              const visible = dayEvents.slice(0, MAX_VISIBLE);
              const overflow = dayEvents.length - visible.length;

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'flex min-h-24 flex-col gap-0.5 border-r border-border/40 p-1 last:border-r-0',
                    !inMonth && 'bg-muted/20',
                  )}
                >
                  <div className="flex justify-end">
                    <span
                      className={cn(
                        'flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums',
                        isToday && 'bg-primary font-semibold text-primary-foreground',
                        !isToday && !inMonth && 'text-muted-foreground/50',
                        !isToday && inMonth && 'text-foreground',
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {visible.map((ev) => (
                      <EventChip key={ev.id} event={ev} variant="chip" />
                    ))}
                    {overflow > 0 && (
                      <MoreEventsPopover day={day} events={dayEvents} count={overflow} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
