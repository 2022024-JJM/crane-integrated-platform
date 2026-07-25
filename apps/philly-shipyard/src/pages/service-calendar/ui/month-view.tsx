import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarEvent } from '@crane/features/calendar';
import { canRescheduleEvent } from '@crane/features/calendar';
import { cn } from '@crane/core/lib/utils';
import { buildMonthMatrix, isSameDay, isSameMonth, startOfDay } from '../model/date-utils';
import { buildSpanSegments, daysDiff } from '../model/week-segments';
import { formatMonthDay, formatWeekdayShort } from '../model/format';
import { EventChip, EventStripBar } from './event-chip';
import { MoreEventsPopover } from './more-events-popover';
import { FOCUS_RING } from '../../../shared/ui/controls';

// 셀당 이벤트 줄 수 — 초과분은 'N개 더보기' (구글 캘린더식 슬롯 스택)
const MAX_SLOTS = 4;
// 이 거리(px) 이상 움직여야 드래그로 간주 — 미만이면 클릭(팝오버)
const DRAG_THRESHOLD = 5;

interface DragState {
  event: CalendarEvent;
  /** 드래그 시작 시 포인터 아래 날짜 (상대 이동 기준점) */
  grabDay: Date;
  targetDay: Date;
}

interface PendingDrag {
  event: CalendarEvent;
  x: number;
  y: number;
  active: boolean;
  grabDay?: Date;
}

export function MonthView({
  anchor,
  events,
  onDayClick,
  onEmptyClick,
  onReschedule,
}: {
  anchor: Date;
  events: CalendarEvent[];
  /** 날짜 숫자 클릭 → 해당 일의 일 뷰 (구글 캘린더 드릴다운) */
  onDayClick: (day: Date) => void;
  /** 빈 셀 클릭 → 해당 날짜 프리필 일정 생성 */
  onEmptyClick: (day: Date) => void;
  /** 드래그 이동 커밋 — deltaDays만큼 일정을 옮긴다 */
  onReschedule: (event: CalendarEvent, deltaDays: number) => void;
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

  // ── 드래그 이동 (구글 캘린더식 day-shift) ──
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PendingDrag | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  const updateDrag = (d: DragState | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  const dayAtPoint = (clientX: number, clientY: number): Date | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const col = Math.min(6, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * 7)));
    const row = Math.min(
      weeks.length - 1,
      Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * weeks.length)),
    );
    return weeks[row][col];
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const pending = pendingRef.current;
      if (!pending) return;
      if (!pending.active) {
        if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < DRAG_THRESHOLD) return;
        const grabDay = dayAtPoint(pending.x, pending.y);
        if (!grabDay) {
          pendingRef.current = null;
          return;
        }
        pending.active = true;
        pending.grabDay = grabDay;
      }
      const target = dayAtPoint(e.clientX, e.clientY);
      if (target && pending.grabDay) {
        updateDrag({ event: pending.event, grabDay: pending.grabDay, targetDay: target });
      }
    };
    const onUp = () => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      const d = dragRef.current;
      updateDrag(null);
      if (pending?.active) {
        // 드래그 직후의 click이 팝오버를 열지 않게 억제
        suppressClickRef.current = true;
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        if (d) {
          const delta = daysDiff(startOfDay(d.targetDay), startOfDay(d.grabDay));
          if (delta !== 0) onReschedule(d.event, delta);
        }
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, onReschedule]);

  const handleChipPointerDown = (e: React.PointerEvent, event: CalendarEvent) => {
    if (e.button !== 0 || !canRescheduleEvent(event)) return;
    pendingRef.current = { event, x: e.clientX, y: e.clientY, active: false };
  };

  const handleChipClickCapture = (e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

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

      {/* 주 그리드 — 실제 주 수(4~6)만 렌더 */}
      <div
        ref={gridRef}
        className={cn('grid min-h-0 flex-1', drag && 'cursor-grabbing select-none')}
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        {weekRows.map(({ week, segments, coveringByCol }, wi) => {
          const moreByCol = coveringByCol.map(
            (_, c) =>
              segments.filter(
                (s) => s.slot >= MAX_SLOTS && c >= s.startCol && c < s.startCol + s.span,
              ).length,
          );

          return (
            <div key={wi} className="relative min-h-28 overflow-hidden border-b border-border/40 last:border-b-0">
              {/* 배경 셀 — 클릭하면 해당 날짜로 일정 생성 (구글 캘린더식) */}
              <div className="absolute inset-0 grid grid-cols-7">
                {week.map((day) => {
                  const isDropTarget = drag && isSameDay(day, drag.targetDay);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      tabIndex={-1}
                      aria-hidden
                      onClick={() => onEmptyClick(day)}
                      className={cn(FOCUS_RING, 
                        'cursor-pointer border-r border-border/40 transition-colors last:border-r-0',
                        !isSameMonth(day, anchor) && 'bg-muted/20',
                        !drag && 'hover:bg-muted/30',
                        isDropTarget && 'bg-primary/10 ring-1 ring-inset ring-primary/40',
                      )}
                    />
                  );
                })}
              </div>

              {/* 콘텐츠 — 배경 클릭이 통과하도록 래퍼는 pointer-events-none,
                  상호작용 요소(날짜·칩·더보기)만 다시 auto */}
              <div className="pointer-events-none relative grid grid-cols-7 auto-rows-min gap-y-px">
                {/* 날짜 숫자 — 클릭 시 일 뷰 드릴다운 */}
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
                      <button
                        type="button"
                        onClick={() => onDayClick(day)}
                        className={cn(FOCUS_RING, 
                          'pointer-events-auto flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-full px-1.5 text-xs tabular-nums transition-colors',
                          isToday && 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90',
                          !isToday && !inMonth && 'text-muted-foreground/50 hover:bg-muted',
                          !isToday && inMonth && 'text-foreground hover:bg-muted',
                        )}
                      >
                        {isFirstOfMonth && !isToday ? formatMonthDay(day, language) : day.getDate()}
                      </button>
                    </div>
                  );
                })}

                {/* 이벤트 세그먼트 — slot 초과분은 더보기로 */}
                {segments
                  .filter((s) => s.slot < MAX_SLOTS)
                  .map((s) => (
                    <div
                      key={`${s.event.id}-${s.startCol}`}
                      className={cn(
                        'pointer-events-auto min-w-0 touch-none px-0.5',
                        drag?.event.id === s.event.id && 'opacity-40',
                      )}
                      style={{
                        gridColumn: `${s.startCol + 1} / span ${s.span}`,
                        gridRow: s.slot + 2,
                      }}
                      onPointerDown={(e) => handleChipPointerDown(e, s.event)}
                      onClickCapture={handleChipClickCapture}
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
                      className="pointer-events-auto min-w-0 px-0.5"
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
