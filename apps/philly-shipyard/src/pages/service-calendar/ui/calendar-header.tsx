import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import type { ViewMode } from '../model/types';
import { buildWeekDays } from '../model/date-utils';
import {
  formatDateRange,
  formatDayTitle,
  formatMonthTitle,
} from '../model/format';

const VIEWS: ViewMode[] = ['month', 'week', 'day'];

export function CalendarHeader({
  view,
  anchor,
  onPrev,
  onNext,
  onToday,
  onViewChange,
}: {
  view: ViewMode;
  anchor: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (v: ViewMode) => void;
}) {
  const { t, i18n } = useTranslation('calendar');

  const label =
    view === 'month'
      ? formatMonthTitle(anchor, i18n.language)
      : view === 'day'
        ? formatDayTitle(anchor, i18n.language)
        : (() => {
            const days = buildWeekDays(anchor);
            return formatDateRange(days[0], days[6], i18n.language);
          })();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToday}
          className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          {t('nav.today')}
        </button>
        <div className="flex items-center">
          <button
            type="button"
            onClick={onPrev}
            aria-label={t('nav.prev')}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label={t('nav.next')}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <h2 className="text-base font-bold tabular-nums">{label}</h2>
      </div>

      {/* 뷰 세그먼트 */}
      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={cn(
              'cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors',
              view === v
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`view.${v}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
