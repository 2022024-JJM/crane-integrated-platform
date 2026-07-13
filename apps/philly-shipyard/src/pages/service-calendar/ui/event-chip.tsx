import { useTranslation } from 'react-i18next';
import type { CalendarEvent } from '@crane/features/calendar';
import { Popover, PopoverPopup, PopoverTrigger } from '@crane/ui/molecules/popover';
import { cn } from '@crane/core/lib/utils';
import { eventAccent } from '../model/colors';
import { formatTime, formatTimeShort } from '../model/format';
import { EventPopoverContent } from './event-popover';

/**
 * 캘린더 이벤트 칩. Popover 트리거 자체가 칩이라 중첩 버튼이 생기지 않는다.
 * variant:
 *  - 'chip'  : 월 뷰 셀용 (색 점 + 라벨)
 *  - 'bar'   : 주/일 타임그리드용 (채워진 바, absolute 배치는 부모가 담당)
 *  - 'block' : all-day row / 목록용 (채워진 블록)
 */
/**
 * 여러 날을 가로지르는 솔리드 바 (구글 캘린더식).
 * 표시 기간 밖으로 이어지는 끝은 각지게 렌더한다.
 */
export function EventStripBar({
  event,
  continuesLeft = false,
  continuesRight = false,
}: {
  event: CalendarEvent;
  continuesLeft?: boolean;
  continuesRight?: boolean;
}) {
  const accent = eventAccent(event);
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'flex h-[18px] w-full cursor-pointer items-center px-1.5 text-left text-[11px] font-medium leading-none text-white transition-opacity hover:opacity-90',
          accent,
          continuesLeft ? 'rounded-l-none' : 'rounded-l',
          continuesRight ? 'rounded-r-none' : 'rounded-r',
        )}
      >
        <span className="truncate">{event.title}</span>
      </PopoverTrigger>
      <PopoverPopup align="start" className="p-0">
        <EventPopoverContent event={event} />
      </PopoverPopup>
    </Popover>
  );
}

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
  // 월 셀 칩은 구글식 짧은 표기('오전 8시'), 채움형은 기존 표기 유지
  const timeLabel = event.allDay
    ? ''
    : variant === 'chip'
      ? formatTimeShort(event.start, i18n.language)
      : formatTime(event.start, i18n.language);

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
