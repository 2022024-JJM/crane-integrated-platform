import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CalendarEvent } from '@crane/features/calendar';
import { Badge } from '@crane/ui/atoms/badge';
import { cn } from '@crane/core/lib/utils';
import {
  eventAccent,
  priorityBadgeVariant,
  statusBadgeVariant,
} from '../model/colors';
import { formatTime } from '../model/format';

/** 이벤트 요약 팝오버 내용 — 제목·크레인·상태·시간 + 상세 링크 */
export function EventPopoverContent({ event }: { event: CalendarEvent }) {
  const { t, i18n } = useTranslation('calendar');

  return (
    <div className="w-72 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <span className={cn('size-2 shrink-0 rounded-full', eventAccent(event))} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t(`source.${event.sourceType}`)}
        </span>
      </div>

      <p className="text-sm font-bold leading-snug">{event.title}</p>

      <dl className="mt-3 flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">{t('popover.crane')}</dt>
          <dd className="font-medium">{event.craneName}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">{t('popover.status')}</dt>
          <dd className="flex items-center gap-1">
            <Badge variant={statusBadgeVariant(event)}>{t(`status.${event.status}`)}</Badge>
            {event.sourceType === 'repair' && (
              <Badge variant={priorityBadgeVariant(event.priority)}>
                {t(`priority.${event.priority}`)}
              </Badge>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">{t('popover.time')}</dt>
          <dd className="font-medium tabular-nums">
            {event.allDay
              ? t('allDay')
              : `${formatTime(event.start, i18n.language)} – ${formatTime(event.end, i18n.language)}`}
          </dd>
        </div>
      </dl>

      <Link
        to={event.detailPath}
        className="mt-3 flex items-center justify-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
      >
        {t('popover.viewDetail')}
        <ChevronRight className="size-3.5" />
      </Link>
    </div>
  );
}
