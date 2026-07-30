import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CalendarEvent } from '@crane/features/calendar';
import { canRescheduleEvent } from '@crane/features/calendar';
import { cn } from '@crane/core/lib/utils';
import { TONE_DOT } from '../../../shared/ui/tone';
import { isSameDay, minutesFromMidnight, startOfDay } from '../model/date-utils';
import { eventAccent } from '../model/colors';
import { buildSpanSegments, isStripEvent } from '../model/week-segments';
import { formatHourLabel, formatTime, formatWeekdayShort, gmtOffsetLabel } from '../model/format';
import { EventStripBar } from './event-chip';
import { EventPopoverContent } from './event-popover';
import { Popover, PopoverPopup, PopoverTrigger } from '@crane/ui/molecules/popover';
import { FOCUS_RING } from '../../../shared/ui/controls';

const START_HOUR = 0;
const END_HOUR = 24; // 구글 캘린더처럼 24시간 전체 — 세로 스크롤로 탐색
const ROW_H = 48; // 시간당 px
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
// 오늘이 안 보이는 주/일에서의 초기 스크롤 기준 시각 (업무 시작 전 아침)
const DEFAULT_SCROLL_HOUR = 7;
const GUTTER_PX = 64;
// 드래그 스냅 간격(분)과 드래그 판정 거리(px)
const SNAP_MIN = 15;
const DRAG_THRESHOLD = 4;
// 종일 행 접힘 시 표시 줄 수 — 초과 시 펼치기 토글 (구글 캘린더식)
const ALLDAY_COLLAPSED_ROWS = 2;

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

const snap = (min: number) => Math.round(min / SNAP_MIN) * SNAP_MIN;

interface DragState {
  event: CalendarEvent;
  mode: 'move' | 'resize';
  dayIndex: number;
  startMin: number;
  endMin: number;
}

interface PendingDrag {
  event: CalendarEvent;
  mode: 'move' | 'resize';
  x: number;
  y: number;
  origStartMin: number;
  origEndMin: number;
  origDayIndex: number;
  active: boolean;
}

function DayColumn({
  day,
  dayIndex,
  events,
  isToday,
  now,
  language,
  draggingId,
  onEmptyClick,
  onEventPointerDown,
  onEventClickCapture,
}: {
  day: Date;
  dayIndex: number;
  events: CalendarEvent[];
  isToday: boolean;
  now: Date;
  language: string;
  draggingId: string | null;
  onEmptyClick: (day: Date) => void;
  onEventPointerDown: (
    e: React.PointerEvent,
    event: CalendarEvent,
    dayIndex: number,
    mode: 'move' | 'resize',
  ) => void;
  onEventClickCapture: (e: React.MouseEvent) => void;
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
      {/* 시간 배경 — 30분 슬롯 클릭 시 해당 날짜로 일정 생성 (구글 캘린더식) */}
      {HOURS.map((h) => (
        <div key={h} className="border-b border-border/30" style={{ height: ROW_H }}>
          <div
            className="h-1/2 cursor-pointer transition-colors hover:bg-primary/5"
            onClick={() => onEmptyClick(day)}
          />
          <div
            className="h-1/2 cursor-pointer transition-colors hover:bg-primary/5"
            onClick={() => onEmptyClick(day)}
          />
        </div>
      ))}

      {/* 현재 시각 표시선 */}
      {showNow && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10"
          style={{ top: ((nowMin - gridStart) / 60) * ROW_H }}
        >
          <div className={cn('h-px', TONE_DOT.critical)} />
          <span className={cn('absolute -left-1 -top-1 size-2 rounded-full', TONE_DOT.critical)} />
        </div>
      )}

      {/* timed 이벤트 */}
      {placed.map(({ event, lane, laneCount }) => {
        const startMin = Math.max(gridStart, minutesFromMidnight(event.start));
        const endMin = Math.min(gridEnd, minutesFromMidnight(event.end));
        const top = ((startMin - gridStart) / 60) * ROW_H;
        const height = Math.max(18, ((endMin - startMin) / 60) * ROW_H);
        const widthPct = 100 / laneCount;
        const draggable = canRescheduleEvent(event);
        return (
          <div
            key={event.id}
            className={cn('absolute px-0.5', draggingId === event.id && 'opacity-40')}
            style={{
              top,
              height,
              left: `${lane * widthPct}%`,
              width: `${widthPct}%`,
            }}
            onPointerDown={
              draggable ? (e) => onEventPointerDown(e, event, dayIndex, 'move') : undefined
            }
            onClickCapture={onEventClickCapture}
          >
            <Popover>
              <PopoverTrigger
                className={cn(
                  'flex h-full w-full cursor-pointer flex-col overflow-hidden rounded border-l-4 border-black/20 px-1.5 py-1 text-left text-[11px] leading-tight text-white transition-opacity hover:opacity-90',
                  draggable && 'touch-none',
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
            {/* 리사이즈 핸들 (하단 가장자리) */}
            {draggable && (
              <div
                className="absolute inset-x-0.5 bottom-0 h-1.5 cursor-ns-resize touch-none"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onEventPointerDown(e, event, dayIndex, 'resize');
                }}
              />
            )}
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
  onDayClick,
  onEmptyClick,
  onReschedule,
}: {
  days: Date[];
  events: CalendarEvent[];
  /** 요일 헤더 클릭 → 일 뷰 드릴다운 (주 뷰에서만) */
  onDayClick: (day: Date) => void;
  /** 빈 슬롯 클릭 → 해당 날짜 프리필 일정 생성 */
  onEmptyClick: (day: Date) => void;
  /** 드래그 이동/리사이즈 커밋 */
  onReschedule: (event: CalendarEvent, newStart: Date, newEnd: Date) => void;
}) {
  const { t, i18n } = useTranslation('calendar');
  const language = i18n.language;
  const now = new Date();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 최초 마운트 시 초기 스크롤 — 오늘이 보이면 현재 시각, 아니면 아침(07:00) 부근.
  // (구글 캘린더 동작. 주/일 이동 시에는 스크롤 위치를 유지한다)
  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const current = new Date();
    const hasToday = days.some((d) => isSameDay(d, current));
    const targetMin = hasToday ? minutesFromMidnight(current) : DEFAULT_SCROLL_HOUR * 60;
    // 기준 시각이 뷰포트 상단 1/3 지점에 오도록
    viewport.scrollTop = Math.max(0, (targetMin / 60) * ROW_H - viewport.clientHeight / 3);
    // 마운트 시 1회만 — 날짜 이동 시 재스크롤하지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const gridCols = { gridTemplateColumns: `${GUTTER_PX}px repeat(${days.length}, minmax(0, 1fr))` };
  const dayCols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };

  // 종일/다일 이벤트 — 구글 캘린더처럼 날짜 범위를 가로지르는 스패닝 바로 배치
  const stripSegments = useMemo(
    () => buildSpanSegments(days, events.filter(isStripEvent)).segments,
    [days, events],
  );
  const hasAllDay = stripSegments.length > 0;

  // ── 종일 행 접기 (줄 수가 많을 때 구글 캘린더처럼 축약) ──
  const [allDayExpanded, setAllDayExpanded] = useState(false);
  const stripRowCount = stripSegments.reduce((m, s) => Math.max(m, s.slot), -1) + 1;
  const collapsible = stripRowCount > ALLDAY_COLLAPSED_ROWS + 1;
  const visibleRows = collapsible && !allDayExpanded ? ALLDAY_COLLAPSED_ROWS : stripRowCount;
  const visibleStrips = stripSegments.filter((s) => s.slot < visibleRows);
  const hiddenByCol = days.map(
    (_, c) =>
      stripSegments.filter(
        (s) => s.slot >= visibleRows && c >= s.startCol && c < s.startCol + s.span,
      ).length,
  );

  // ── 드래그 이동/리사이즈 (timed 이벤트, 15분 스냅) ──
  const pendingRef = useRef<PendingDrag | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  const updateDrag = (d: DragState | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  const dayIndexAtX = (clientX: number): number => {
    const el = contentRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const w = rect.width - GUTTER_PX;
    if (w <= 0) return 0;
    return Math.min(
      days.length - 1,
      Math.max(0, Math.floor(((clientX - rect.left - GUTTER_PX) / w) * days.length)),
    );
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const pending = pendingRef.current;
      if (!pending) return;
      if (!pending.active) {
        if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < DRAG_THRESHOLD) return;
        pending.active = true;
      }
      const deltaMin = snap(((e.clientY - pending.y) / ROW_H) * 60);
      if (pending.mode === 'move') {
        const duration = pending.origEndMin - pending.origStartMin;
        const startMin = Math.min(
          24 * 60 - duration,
          Math.max(0, pending.origStartMin + deltaMin),
        );
        updateDrag({
          event: pending.event,
          mode: 'move',
          dayIndex: dayIndexAtX(e.clientX),
          startMin,
          endMin: startMin + duration,
        });
      } else {
        const endMin = Math.min(
          24 * 60,
          Math.max(pending.origStartMin + SNAP_MIN, pending.origEndMin + deltaMin),
        );
        updateDrag({
          event: pending.event,
          mode: 'resize',
          dayIndex: pending.origDayIndex,
          startMin: pending.origStartMin,
          endMin,
        });
      }
    };
    const onUp = () => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      const d = dragRef.current;
      updateDrag(null);
      if (!pending?.active || !d) return;
      // 드래그 직후의 click이 팝오버를 열지 않게 억제
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);

      const changed =
        d.dayIndex !== pending.origDayIndex ||
        d.startMin !== pending.origStartMin ||
        d.endMin !== pending.origEndMin;
      if (!changed) return;

      const base = days[d.dayIndex];
      const newStart = new Date(
        base.getFullYear(), base.getMonth(), base.getDate(),
        0, d.startMin, pending.event.start.getSeconds(),
      );
      const newEnd = new Date(
        base.getFullYear(), base.getMonth(), base.getDate(),
        0, d.endMin, pending.event.end.getSeconds(),
      );
      onReschedule(pending.event, newStart, newEnd);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, onReschedule]);

  const handleEventPointerDown = (
    e: React.PointerEvent,
    event: CalendarEvent,
    dayIndex: number,
    mode: 'move' | 'resize',
  ) => {
    if (e.button !== 0) return;
    pendingRef.current = {
      event,
      mode,
      x: e.clientX,
      y: e.clientY,
      origStartMin: minutesFromMidnight(event.start),
      origEndMin: Math.max(minutesFromMidnight(event.start) + SNAP_MIN, minutesFromMidnight(event.end)),
      origDayIndex: dayIndex,
      active: false,
    };
  };

  const handleEventClickCapture = (e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // 드래그 프리뷰 시각 라벨
  const previewTimes = drag
    ? (() => {
        const base = days[drag.dayIndex];
        const s = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, drag.startMin);
        const en = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, drag.endMin);
        return `${formatTime(s, language)} – ${formatTime(en, language)}`;
      })()
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/80">
      {/* 요일 헤더 */}
      <div className="grid border-b border-border/60 bg-muted/40" style={gridCols}>
        {/* 코너 셀 — 구글 캘린더처럼 GMT 오프셋 표시 */}
        <div className="flex items-end justify-end border-r border-border/40 px-1 pb-1">
          <span className="text-[10px] text-muted-foreground/70">{gmtOffsetLabel()}</span>
        </div>
        {days.map((day) => {
          const isToday = isSameDay(day, now);
          const clickable = days.length > 1;
          const inner = (
            <>
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
            </>
          );
          return clickable ? (
            // 요일 헤더 클릭 → 일 뷰 드릴다운 (구글 캘린더)
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDayClick(day)}
              className={cn('cursor-pointer border-r border-border/40 py-2 text-center transition-colors last:border-r-0 hover:bg-muted/60', FOCUS_RING)}
            >
              {inner}
            </button>
          ) : (
            <div
              key={day.toISOString()}
              className="border-r border-border/40 py-2 text-center last:border-r-0"
            >
              {inner}
            </div>
          );
        })}
      </div>

      {/* 종일 이벤트 행 — 여러 날을 가로지르는 스패닝 바 (구글 캘린더식) */}
      {hasAllDay && (
        <div className="grid border-b border-border/60 bg-muted/10" style={gridCols}>
          <div className="flex flex-col items-end justify-between gap-1 border-r border-border/40 px-1.5 py-1.5">
            <span className="text-[10px] text-muted-foreground">{t('allDay')}</span>
            {collapsible && (
              <button
                type="button"
                onClick={() => setAllDayExpanded((v) => !v)}
                aria-label={allDayExpanded ? t('allDayCollapse') : t('allDayExpand')}
                title={allDayExpanded ? t('allDayCollapse') : t('allDayExpand')}
                className={cn('cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
              >
                {allDayExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
            )}
          </div>
          <div className="relative py-1" style={{ gridColumn: `2 / span ${days.length}` }}>
            {/* 배경 세로 구분선 */}
            <div className="absolute inset-0 grid" style={dayCols}>
              {days.map((_, i) => (
                <div key={i} className="border-r border-border/40 last:border-r-0" />
              ))}
            </div>
            {/* 스패닝 바 슬롯 */}
            <div className="relative grid auto-rows-min gap-y-px" style={dayCols}>
              {visibleStrips.map((s) => (
                <div
                  key={`${s.event.id}-${s.startCol}`}
                  className="min-w-0 px-0.5"
                  style={{
                    gridColumn: `${s.startCol + 1} / span ${s.span}`,
                    gridRow: s.slot + 1,
                  }}
                >
                  <EventStripBar
                    event={s.event}
                    continuesLeft={s.continuesLeft}
                    continuesRight={s.continuesRight}
                  />
                </div>
              ))}
              {/* 접힘 시 숨은 줄 수 — 클릭하면 펼침 */}
              {collapsible &&
                !allDayExpanded &&
                hiddenByCol.map((n, ci) =>
                  n > 0 ? (
                    <button
                      key={`hidden-${ci}`}
                      type="button"
                      onClick={() => setAllDayExpanded(true)}
                      className={cn('min-w-0 cursor-pointer rounded px-1.5 text-left text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
                      style={{ gridColumn: ci + 1, gridRow: visibleRows + 1 }}
                    >
                      {t('moreCount', { count: n })}
                    </button>
                  ) : null,
                )}
            </div>
          </div>
        </div>
      )}

      {/* 시간 그리드 — 네이티브 세로 스크롤 (base-ui ScrollArea는 flex 최소높이 계산과
          충돌해 페이지 전체가 늘어나므로 사용하지 않는다) */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          ref={contentRef}
          className={cn('relative grid', drag && 'cursor-grabbing select-none')}
          style={gridCols}
        >
          {/* 시간 눈금 — 구글 캘린더처럼 자정(0시) 라벨은 생략 */}
          <div className="border-r border-border/40">
            {HOURS.map((h) => (
              <div
                key={h}
                className="relative border-b border-border/30 text-right"
                style={{ height: ROW_H }}
              >
                {h > 0 && (
                  <span className="absolute -top-2 right-1.5 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
                    {formatHourLabel(h, language)}
                  </span>
                )}
              </div>
            ))}
          </div>
          {days.map((day, i) => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              dayIndex={i}
              events={eventsByDay[i]}
              isToday={isSameDay(day, now)}
              now={now}
              language={language}
              draggingId={drag?.event.id ?? null}
              onEmptyClick={onEmptyClick}
              onEventPointerDown={handleEventPointerDown}
              onEventClickCapture={handleEventClickCapture}
            />
          ))}

          {/* 드래그 프리뷰 */}
          {drag && (
            <div
              className="pointer-events-none absolute z-20 px-0.5"
              style={{
                left: `calc(${GUTTER_PX}px + (100% - ${GUTTER_PX}px) * ${drag.dayIndex} / ${days.length})`,
                width: `calc((100% - ${GUTTER_PX}px) / ${days.length})`,
                top: (drag.startMin / 60) * ROW_H,
                height: Math.max(18, ((drag.endMin - drag.startMin) / 60) * ROW_H),
              }}
            >
              <div
                className={cn(
                  'flex h-full flex-col overflow-hidden rounded border-l-4 border-black/20 px-1.5 py-1 text-[11px] leading-tight text-white opacity-90 shadow-lg',
                  eventAccent(drag.event),
                )}
              >
                <span className="shrink-0 font-medium tabular-nums">{previewTimes}</span>
                <span className="truncate font-medium">{drag.event.title}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
