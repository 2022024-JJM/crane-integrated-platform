import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServiceCalendar } from '@crane/features/calendar';
import type { ViewMode } from '../model/types';
import { addDays, addMonths, buildWeekDays, startOfDay } from '../model/date-utils';
import { MonthView } from './month-view';
import { TimeGrid } from './time-grid';
import { CalendarHeader } from './calendar-header';
import { CalendarLegend } from './calendar-legend';

export function ServiceCalendarPage() {
  const { t } = useTranslation('calendar');
  const { events } = useServiceCalendar();
  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));

  const shift = (dir: -1 | 1) => {
    setAnchor((prev) => {
      if (view === 'month') return addMonths(prev, dir);
      if (view === 'week') return addDays(prev, dir * 7);
      return addDays(prev, dir);
    });
  };

  const weekDays = useMemo(() => buildWeekDays(anchor), [anchor]);

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <CalendarHeader
        view={view}
        anchor={anchor}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={() => setAnchor(startOfDay(new Date()))}
        onViewChange={setView}
      />

      <CalendarLegend />

      {view === 'month' && <MonthView anchor={anchor} events={events} />}
      {view === 'week' && <TimeGrid days={weekDays} events={events} />}
      {view === 'day' && <TimeGrid days={[anchor]} events={events} />}
    </div>
  );
}
