import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { Calendar } from '@crane/ui/atoms/calendar';
import { Popover, PopoverPopup, PopoverTrigger } from '@crane/ui/molecules/popover';
import type { ViewMode } from '../model/types';
import { buildWeekDays } from '../model/date-utils';
import {
  formatDateRange,
  formatDayTitle,
  formatMonthTitle,
} from '../model/format';

const VIEWS: ViewMode[] = ['month', 'week', 'day', 'schedule'];

// 구글 캘린더 단축키 안내 (title 툴팁)
const VIEW_SHORTCUT: Record<ViewMode, string> = {
  month: 'M',
  week: 'W',
  day: 'D',
  schedule: 'A',
};

export function CalendarHeader({
  view,
  anchor,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onJumpTo,
}: {
  view: ViewMode;
  anchor: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (v: ViewMode) => void;
  /** 타이틀 데이트피커에서 임의 날짜로 이동 */
  onJumpTo: (d: Date) => void;
}) {
  const { t, i18n } = useTranslation('calendar');
  const [pickerOpen, setPickerOpen] = useState(false);

  const label =
    view === 'month' || view === 'schedule'
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
          title={`${t('nav.today')} (T)`}
          className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          {t('nav.today')}
        </button>
        <div className="flex items-center">
          <button
            type="button"
            onClick={onPrev}
            aria-label={t('nav.prev')}
            title={`${t('nav.prev')} (K)`}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label={t('nav.next')}
            title={`${t('nav.next')} (J)`}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* 타이틀 = 데이트피커 트리거 (구글 캘린더식 임의 날짜 점프) */}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger className="group flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-muted">
            <h2 className="text-base font-bold tabular-nums">{label}</h2>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[popup-open]:rotate-180" />
          </PopoverTrigger>
          <PopoverPopup align="start" className="p-0">
            <Calendar
              mode="single"
              selected={anchor}
              defaultMonth={anchor}
              localeCode={i18n.language}
              onSelect={(d) => {
                if (!d) return;
                onJumpTo(d);
                setPickerOpen(false);
              }}
            />
          </PopoverPopup>
        </Popover>
      </div>

      {/* 뷰 세그먼트 */}
      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            title={`${t(`view.${v}`)} (${VIEW_SHORTCUT[v]})`}
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
