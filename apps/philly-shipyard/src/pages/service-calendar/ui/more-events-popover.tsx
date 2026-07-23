import { useTranslation } from 'react-i18next';
import type { CalendarEvent } from '@crane/features/calendar';
import { Popover, PopoverPopup, PopoverTrigger } from '@crane/ui/molecules/popover';
import { EventChip } from './event-chip';

/** 월 셀에서 표시 한도를 넘은 이벤트를 "+N개 더" 트리거로 모아 보여준다 */
export function MoreEventsPopover({
  day,
  events,
  count,
}: {
  day: Date;
  events: CalendarEvent[];
  count: number;
}) {
  const { t, i18n } = useTranslation('calendar');
  const dayLabel = new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
    day: 'numeric',
  }).format(day);

  return (
    <Popover>
      <PopoverTrigger className="w-full cursor-pointer rounded px-1 py-0.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        {t('moreCount', { count })}
      </PopoverTrigger>
      <PopoverPopup align="start" className="p-0">
        <div className="w-64 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{dayLabel}</p>
          <div className="flex flex-col gap-1">
            {events.map((event) => (
              <EventChip key={event.id} event={event} variant="chip" />
            ))}
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
