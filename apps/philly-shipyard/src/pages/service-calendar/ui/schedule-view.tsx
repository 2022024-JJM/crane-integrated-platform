import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarEvent } from '@crane/features/calendar';
import { cn } from '@crane/core/lib/utils';
import { Popover, PopoverPopup, PopoverTrigger } from '@crane/ui/molecules/popover';
import {
  addDays,
  endOfMonth,
  isSameDay,
  startOfDay,
  startOfMonth,
} from '../model/date-utils';
import { eventAccent } from '../model/colors';
import { formatTime, formatWeekdayShort } from '../model/format';
import { EventPopoverContent } from './event-popover';
import { FOCUS_RING } from '../../../shared/ui/controls';

/** 구글 캘린더 Schedule 뷰 — 앵커 월의 일정을 날짜별 목록으로 (빈 날은 생략) */
export function ScheduleView({
  anchor,
  events,
  onDayClick,
}: {
  anchor: Date;
  events: CalendarEvent[];
  /** 날짜 클릭 → 일 뷰 드릴다운 */
  onDayClick: (day: Date) => void;
}) {
  const { t, i18n } = useTranslation('calendar');
  const language = i18n.language;
  const today = new Date();

  const groups = useMemo(() => {
    const first = startOfMonth(anchor);
    const last = endOfMonth(anchor);
    const out: { day: Date; items: CalendarEvent[] }[] = [];
    for (let d = first; d.getTime() <= last.getTime(); d = addDays(d, 1)) {
      const dayMs = startOfDay(d).getTime();
      const items = events.filter((e) => {
        const s = startOfDay(e.start).getTime();
        const en = startOfDay(e.end).getTime();
        return dayMs >= s && dayMs <= en; // 걸치는 모든 날에 표시 (구글 캘린더 동작)
      });
      if (items.length > 0) {
        // 종일 먼저, 그다음 시작 시각순
        items.sort((a, b) => {
          if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
          return a.start.getTime() - b.start.getTime();
        });
        out.push({ day: d, items });
      }
    }
    return out;
  }, [anchor, events]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-16 text-sm text-muted-foreground">
        {t('schedule.empty')}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto rounded-lg border border-border/80">
      <div className="divide-y divide-border/40">
        {groups.map(({ day, items }) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} className="grid grid-cols-[80px_1fr] gap-2 px-3 py-2">
              {/* 날짜 컬럼 — 클릭 시 일 뷰 */}
              <button
                type="button"
                onClick={() => onDayClick(day)}
                className={cn('group flex h-fit cursor-pointer flex-col items-center gap-0.5 rounded-md py-1 transition-colors hover:bg-muted', FOCUS_RING)}
              >
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full text-base tabular-nums',
                    isToday
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : 'font-medium text-foreground group-hover:bg-muted',
                  )}
                >
                  {day.getDate()}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {formatWeekdayShort(day, language)}
                </span>
              </button>

              {/* 이벤트 목록 */}
              <div className="flex min-w-0 flex-col gap-0.5">
                {items.map((event) => (
                  <Popover key={event.id}>
                    <PopoverTrigger className="grid w-full cursor-pointer grid-cols-[110px_auto_1fr] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {event.allDay
                          ? t('allDay')
                          : `${formatTime(event.start, language)} – ${formatTime(event.end, language)}`}
                      </span>
                      <span className={cn('size-2.5 shrink-0 rounded-full', eventAccent(event))} />
                      <span className="truncate">
                        <span className="font-medium">{event.title}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{event.craneName}</span>
                      </span>
                    </PopoverTrigger>
                    <PopoverPopup align="start" className="p-0">
                      <EventPopoverContent event={event} />
                    </PopoverPopup>
                  </Popover>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
