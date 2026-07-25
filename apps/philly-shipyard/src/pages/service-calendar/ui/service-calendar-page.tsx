import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useRescheduleEvent, useServiceCalendar } from '@crane/features/calendar';
import type { CalendarEvent } from '@crane/features/calendar';
import type { ViewMode } from '../model/types';
import { addDays, addMonths, buildWeekDays, startOfDay } from '../model/date-utils';
import { toLocalDateString } from '../../../shared/lib/relative-date';
import { MonthView } from './month-view';
import { TimeGrid } from './time-grid';
import { CalendarHeader } from './calendar-header';
import { CalendarLegend } from './calendar-legend';
import { ScheduleView } from './schedule-view';
import { cn } from '@crane/core/lib/utils';
import { PAGE_TITLE, PAGE_SUBTITLE } from '../../../shared/ui/page';

export function ServiceCalendarPage() {
  const { t, i18n } = useTranslation('calendar');
  const { events } = useServiceCalendar();
  const reschedule = useRescheduleEvent();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));

  const shift = useCallback(
    (dir: -1 | 1) => {
      setAnchor((prev) => {
        if (view === 'month' || view === 'schedule') return addMonths(prev, dir);
        if (view === 'week') return addDays(prev, dir * 7);
        return addDays(prev, dir);
      });
    },
    [view],
  );

  const goToday = useCallback(() => setAnchor(startOfDay(new Date())), []);

  /** 날짜 숫자·요일 헤더 클릭 → 해당 일의 일 뷰 (구글 캘린더 드릴다운) */
  const jumpToDay = useCallback((d: Date) => {
    setAnchor(startOfDay(d));
    setView('day');
  }, []);

  /** 빈 셀/슬롯 클릭 → 해당 날짜가 프리필된 티켓 생성 (구글 캘린더의 클릭-생성) */
  const createAt = useCallback(
    (day: Date) => {
      navigate(`/ticket/create?type=inspection&date=${toLocalDateString(day)}`);
    },
    [navigate],
  );

  /** 드래그 이동/리사이즈 커밋 + 토스트 */
  const commitReschedule = useCallback(
    (event: CalendarEvent, newStart: Date, newEnd: Date) => {
      if (!reschedule(event, newStart, newEnd)) return;
      const dateLabel = new Intl.DateTimeFormat(i18n.language, {
        month: 'short',
        day: 'numeric',
      }).format(newStart);
      toast.success(t('toast.rescheduled', { woNumber: event.woNumber, date: dateLabel }));
    },
    [reschedule, t, i18n.language],
  );

  /** 월 뷰 드래그 — 시각은 유지한 채 날짜만 delta만큼 이동 */
  const commitDayShift = useCallback(
    (event: CalendarEvent, deltaDays: number) => {
      commitReschedule(event, addDays(event.start, deltaDays), addDays(event.end, deltaDays));
    },
    [commitReschedule],
  );

  // 구글 캘린더 키보드 단축키 — T(오늘) J/N(다음) K/P(이전) M/W/D/A(뷰)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      ) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case 't':
          goToday();
          break;
        case 'j':
        case 'n':
          shift(1);
          break;
        case 'k':
        case 'p':
          shift(-1);
          break;
        case 'm':
          setView('month');
          break;
        case 'w':
          setView('week');
          break;
        case 'd':
          setView('day');
          break;
        case 'a':
        case 's':
          setView('schedule');
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shift, goToday]);

  const weekDays = useMemo(() => buildWeekDays(anchor), [anchor]);

  // 전체 높이 캘린더 특성상 PAGE_CONTAINER(gap-6) 대신 h-full + gap-4 유지 — shared/ui/page.ts 참고
  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className={PAGE_TITLE}>{t('title')}</h1>
        <p className={cn(PAGE_SUBTITLE, 'mt-0.5')}>{t('description')}</p>
      </div>

      <CalendarHeader
        view={view}
        anchor={anchor}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={goToday}
        onViewChange={setView}
        onJumpTo={(d) => setAnchor(startOfDay(d))}
      />

      <CalendarLegend />

      {view === 'month' && (
        <MonthView
          anchor={anchor}
          events={events}
          onDayClick={jumpToDay}
          onEmptyClick={createAt}
          onReschedule={commitDayShift}
        />
      )}
      {view === 'week' && (
        <TimeGrid
          days={weekDays}
          events={events}
          onDayClick={jumpToDay}
          onEmptyClick={createAt}
          onReschedule={commitReschedule}
        />
      )}
      {view === 'day' && (
        <TimeGrid
          days={[anchor]}
          events={events}
          onDayClick={jumpToDay}
          onEmptyClick={createAt}
          onReschedule={commitReschedule}
        />
      )}
      {view === 'schedule' && (
        <ScheduleView anchor={anchor} events={events} onDayClick={jumpToDay} />
      )}
    </div>
  );
}
