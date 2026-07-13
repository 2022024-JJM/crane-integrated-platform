import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarEvent } from '@crane/features/calendar';
import { cn } from '@crane/core/lib/utils';
import { buildMonthMatrix, isSameDay, isSameMonth } from '../model/date-utils';
import { buildSpanSegments } from '../model/week-segments';
import { formatMonthDay, formatWeekdayShort } from '../model/format';
import { EventChip, EventStripBar } from './event-chip';
import { MoreEventsPopover } from './more-events-popover';

// 셀당 이벤트 줄 수 — 초과분은 'N개 더보기' (구글 캘린더식 슬롯 스택)
const MAX_SLOTS = 4;

export function MonthView({
  anchor,
  events,
}: {
  anchor: Date;
  events: CalendarEvent[];
}) {
  const { i18n } = useTranslation('calendar');
  const language = i18n.language;
  const today = new Date();

  const weeks = useMemo(() => buildMonthMatrix(anchor), [anchor]);
  const weekRows = useMemo(
    () => weeks.map((week) => ({ week, ...buildSpanSegments(week, events) })),
    [weeks, events],
  );

  const weekdayLabels = weeks[0].map((d) => formatWeekdayShort(d, language));

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border/80">
      {/* 요일 헤더 (월요일 시작) */}
      <div className="grid grid-cols-7 border-b border-border/60 bg-muted/40">
        {weekdayLabels.map((label, i) => (
          <div
            key={i}
            className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* 주 그리드 */}
      <div className="grid min-h-0 flex-1 grid-rows-6">
        {weekRows.map(({ week, segments, coveringByCol }, wi) => {
          const moreByCol = coveringByCol.map(
            (_, c) =>
              segments.filter(
                (s) => s.slot >= MAX_SLOTS && c >= s.startCol && c < s.startCol + s.span,
              ).length,
          );

          return (
            <div key={wi} className="relative min-h-28 overflow-hidden border-b border-border/40 last:border-b-0">
              {/* 배경 셀 (테두리·타월 음영) */}
              <div className="absolute inset-0 grid grid-cols-7">
                {week.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'border-r border-border/40 last:border-r-0',
                      !isSameMonth(day, anchor) && 'bg-muted/20',
                    )}
                  />
                ))}
              </div>

              {/* 콘텐츠 — 날짜 줄 + 이벤트 슬롯 (스패닝 바는 열 범위를 가로지른다) */}
              <div className="relative grid grid-cols-7 auto-rows-min gap-y-px">
                {/* 날짜 숫자 (구글식 중앙 정렬, 월 경계는 '7월 1일') */}
                {week.map((day, ci) => {
                  const isToday = isSameDay(day, today);
                  const inMonth = isSameMonth(day, anchor);
                  const isFirstOfMonth = day.getDate() === 1;
                  return (
                    <div
                      key={day.toISOString()}
                      className="flex justify-center py-1"
                      style={{ gridColumn: ci + 1, gridRow: 1 }}
                    >
                      <span
                        className={cn(
                          'flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs tabular-nums',
                          isToday && 'bg-primary font-semibold text-primary-foreground',
                          !isToday && !inMonth && 'text-muted-foreground/50',
                          !isToday && inMonth && 'text-foreground',
                        )}
                      >
                        {isFirstOfMonth && !isToday ? formatMonthDay(day, language) : day.getDate()}
                      </span>
                    </div>
                  );
                })}

                {/* 이벤트 세그먼트 — slot 초과분은 더보기로 */}
                {segments
                  .filter((s) => s.slot < MAX_SLOTS)
                  .map((s) => (
                    <div
                      key={`${s.event.id}-${s.startCol}`}
                      className="min-w-0 px-0.5"
                      style={{
                        gridColumn: `${s.startCol + 1} / span ${s.span}`,
                        gridRow: s.slot + 2,
                      }}
                    >
                      {s.isStrip ? (
                        <EventStripBar
                          event={s.event}
                          continuesLeft={s.continuesLeft}
                          continuesRight={s.continuesRight}
                        />
                      ) : (
                        <EventChip event={s.event} variant="chip" />
                      )}
                    </div>
                  ))}

                {/* N개 더보기 */}
                {moreByCol.map((n, ci) =>
                  n > 0 ? (
                    <div
                      key={`more-${ci}`}
                      className="min-w-0 px-0.5"
                      style={{ gridColumn: ci + 1, gridRow: MAX_SLOTS + 2 }}
                    >
                      <MoreEventsPopover day={week[ci]} events={coveringByCol[ci]} count={n} />
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
