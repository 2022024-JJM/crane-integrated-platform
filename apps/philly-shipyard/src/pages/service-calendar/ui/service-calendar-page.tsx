import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useRescheduleEvent, useServiceCalendar } from '@crane/features/calendar';
import type { CalendarEvent } from '@crane/features/calendar';
import type { ViewMode } from '../model/types';
import { addDays, addMonths, buildWeekDays, isSameDay, startOfDay } from '../model/date-utils';
import { toLocalDateString } from '../../../shared/lib/relative-date';
import { MonthView } from './month-view';
import { TimeGrid } from './time-grid';
import { CalendarHeader } from './calendar-header';
import { CalendarLegend } from './calendar-legend';
import { ScheduleView } from './schedule-view';
import { cn } from '@crane/core/lib/utils';
import { PAGE_TITLE, PAGE_SUBTITLE } from '../../../shared/ui/page';

const VIEW_MODES: ViewMode[] = ['month', 'week', 'day', 'schedule'];

/** ?date= 파라미터 검증 — 'YYYY-MM-DD'가 아니거나 실재하지 않는 날짜면 null (오늘로 폴백) */
function parseDateParam(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    ? date
    : null;
}

export function ServiceCalendarPage() {
  const { t, i18n } = useTranslation('calendar');
  const { events } = useServiceCalendar();
  const reschedule = useRescheduleEvent();
  const navigate = useNavigate();

  // 뷰·기준일은 ?view=/?date= URL 파라미터가 단일 소스 — 새로고침·뒤로가기·링크 공유에
  // 그대로 살아남고, 기본값(month/오늘)은 URL에서 생략한다. 잘못된 값은 기본값으로 폴백.
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view') as ViewMode | null;
  const view: ViewMode = viewParam && VIEW_MODES.includes(viewParam) ? viewParam : 'month';
  const dateParam = searchParams.get('date');
  const anchor = useMemo(
    () => parseDateParam(dateParam) ?? startOfDay(new Date()),
    [dateParam],
  );

  const applyState = useCallback(
    (nextView: ViewMode, nextAnchor: Date) => {
      const next = new URLSearchParams(searchParams);
      if (nextView === 'month') next.delete('view');
      else next.set('view', nextView);
      if (isSameDay(nextAnchor, startOfDay(new Date()))) next.delete('date');
      else next.set('date', toLocalDateString(nextAnchor));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setView = useCallback((v: ViewMode) => applyState(v, anchor), [applyState, anchor]);
  const setAnchor = useCallback((d: Date) => applyState(view, d), [applyState, view]);

  const shift = useCallback(
    (dir: -1 | 1) => {
      const nextAnchor =
        view === 'month' || view === 'schedule'
          ? addMonths(anchor, dir)
          : view === 'week'
            ? addDays(anchor, dir * 7)
            : addDays(anchor, dir);
      applyState(view, nextAnchor);
    },
    [view, anchor, applyState],
  );

  const goToday = useCallback(
    () => applyState(view, startOfDay(new Date())),
    [view, applyState],
  );

  /** 날짜 숫자·요일 헤더 클릭 → 해당 일의 일 뷰 (구글 캘린더 드릴다운) */
  const jumpToDay = useCallback(
    (d: Date) => applyState('day', startOfDay(d)),
    [applyState],
  );

  /** 빈 셀/슬롯 클릭 → 해당 날짜가 프리필된 티켓 생성 (구글 캘린더의 클릭-생성) */
  const createAt = useCallback(
    (day: Date) => {
      navigate(`/ticket/create?type=inspection&date=${toLocalDateString(day)}`);
    },
    [navigate],
  );

  /** 드래그 이동/리사이즈 커밋 + Undo 토스트 — 잘못 끌었을 때 바로 되돌린다 */
  const commitReschedule = useCallback(
    (event: CalendarEvent, newStart: Date, newEnd: Date) => {
      const undo = reschedule(event, newStart, newEnd);
      if (!undo) return;
      const dateLabel = new Intl.DateTimeFormat(i18n.language, {
        month: 'short',
        day: 'numeric',
      }).format(newStart);
      toast.success(t('toast.rescheduled', { woNumber: event.woNumber, date: dateLabel }), {
        action: { label: t('undo', { ns: 'common', defaultValue: 'Undo' }), onClick: undo },
      });
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
  }, [shift, goToday, setView]);

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
