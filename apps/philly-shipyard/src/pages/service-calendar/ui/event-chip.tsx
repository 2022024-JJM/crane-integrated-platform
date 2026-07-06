import { useTranslation } from 'react-i18next';
import type { CalendarEvent } from '@crane/features/calendar';
import { Popover, PopoverPopup, PopoverTrigger } from '@crane/ui/molecules/popover';
import { cn } from '@crane/core/lib/utils';
import { eventAccent } from '../model/colors';
import { formatTime } from '../model/format';
import { EventPopoverContent } from './event-popover';

/**
 * 캘린더 이벤트 칩. Popover 트리거 자체가 칩이라 중첩 버튼이 생기지 않는다.
 * variant:
 *  - 'chip'  : 월 뷰 셀용 (색 점 + 라벨)
 *  - 'bar'   : 주/일 타임그리드용 (채워진 바, absolute 배치는 부모가 담당)
 *  - 'block' : all-day row / 목록용 (채워진 블록)
 */
export function EventChip({
  event,
  variant = 'chip',
  className,
}: {
  event: CalendarEvent;
  variant?: 'chip' | 'bar' | 'block';
  className?: string;
}) {
  const { i18n } = useTranslation('calendar');
  const accent = eventAccent(event);
  const timeLabel = event.allDay ? '' : formatTime(event.start, i18n.language);

  const triggerClass =
    variant === 'chip'
      ? cn(
          'flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight transition-opacity hover:opacity-80',
        )
      : cn(
          'flex h-full w-full flex-col overflow-hidden rounded px-1.5 py-1 text-left text-[11px] leading-tight text-white transition-opacity hover:opacity-90',
          accent,
        );

  return (
    <Popover>
      <PopoverTrigger className={cn('cursor-pointer', triggerClass, className)}>
        {variant === 'chip' ? (
          <>
            <span className={cn('size-1.5 shrink-0 rounded-full', accent)} />
            {timeLabel && (
              <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
                {timeLabel}
              </span>
            )}
            <span className="truncate">{event.title}</span>
          </>
        ) : (
          <>
            {timeLabel && (
              <span className="shrink-0 font-medium tabular-nums opacity-90">{timeLabel}</span>
            )}
            <span className="truncate font-medium">{event.title}</span>
          </>
        )}
      </PopoverTrigger>
      <PopoverPopup align="start" className="p-0">
        <EventPopoverContent event={event} />
      </PopoverPopup>
    </Popover>
  );
}
